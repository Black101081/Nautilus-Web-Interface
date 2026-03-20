"""
Portfolio Analytics Router
Provides walk-forward analysis, correlation matrix, and position sizing analytics.
"""

import json
import math
import random
import statistics
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

import database
from auth_jwt import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ---------------------------------------------------------------------------
# Helper: pull filled orders / trades from DB
# ---------------------------------------------------------------------------

async def _get_trades() -> List[Dict[str, Any]]:
    """Return all filled orders from DB as trade records."""
    orders = await database.list_orders()
    return [o for o in orders if o.get("status", "").lower() == "filled"]


def _pnl_series(trades: List[Dict]) -> List[float]:
    return [float(t.get("pnl") or 0.0) for t in trades]


# ---------------------------------------------------------------------------
# Performance summary
# ---------------------------------------------------------------------------

@router.get("/performance")
async def performance_summary(_user: dict = Depends(get_current_user)):
    """Compute overall portfolio performance metrics."""
    trades = await _get_trades()
    pnls = _pnl_series(trades)

    total_pnl = sum(pnls)
    total_trades = len(pnls)
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    win_rate = len(wins) / total_trades if total_trades else 0.0
    avg_win = statistics.mean(wins) if wins else 0.0
    avg_loss = statistics.mean(losses) if losses else 0.0
    profit_factor = abs(sum(wins) / sum(losses)) if losses and sum(losses) != 0 else float("inf")

    # Max drawdown
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    for p in pnls:
        equity += p
        if equity > peak:
            peak = equity
        dd = peak - equity
        if dd > max_dd:
            max_dd = dd

    # Sharpe (daily, simplified)
    if len(pnls) >= 2:
        mean_r = statistics.mean(pnls)
        std_r = statistics.stdev(pnls)
        sharpe = (mean_r / std_r * math.sqrt(252)) if std_r > 0 else 0.0
    else:
        sharpe = 0.0

    return {
        "total_pnl": round(total_pnl, 4),
        "total_trades": total_trades,
        "win_rate": round(win_rate, 4),
        "avg_win": round(avg_win, 4),
        "avg_loss": round(avg_loss, 4),
        "profit_factor": round(profit_factor, 4) if profit_factor != float("inf") else None,
        "max_drawdown": round(max_dd, 4),
        "sharpe_ratio": round(sharpe, 4),
        "gross_profit": round(sum(wins), 4),
        "gross_loss": round(sum(losses), 4),
    }


# ---------------------------------------------------------------------------
# Equity curve
# ---------------------------------------------------------------------------

@router.get("/equity-curve")
async def equity_curve(_user: dict = Depends(get_current_user)):
    """Return running equity curve data points."""
    trades = await _get_trades()
    equity = 0.0
    points = []
    for t in trades:
        equity += float(t.get("pnl") or 0.0)
        points.append({
            "timestamp": t.get("timestamp", ""),
            "equity": round(equity, 4),
            "pnl": round(float(t.get("pnl") or 0.0), 4),
            "instrument": t.get("instrument", ""),
        })
    return {"points": points, "count": len(points), "final_equity": round(equity, 4)}


# ---------------------------------------------------------------------------
# Walk-forward analysis
# ---------------------------------------------------------------------------

class WalkForwardRequest(BaseModel):
    strategy_id: str
    in_sample_bars: int = Field(200, ge=50, le=2000, description="Number of bars in each in-sample window")
    out_sample_bars: int = Field(50, ge=10, le=500, description="Number of bars in each out-of-sample window")
    windows: int = Field(5, ge=2, le=20, description="Number of walk-forward windows")
    symbol: str = "BTCUSDT"
    interval: str = "1h"


@router.post("/walk-forward")
async def walk_forward_analysis(
    req: WalkForwardRequest,
    _user: dict = Depends(get_current_user),
):
    """
    Perform walk-forward analysis on a strategy.

    Splits historical OHLCV data into alternating in-sample (training) and
    out-of-sample (testing) windows. Returns performance metrics per window
    and overall combined out-of-sample statistics.
    """
    import market_data_service as svc

    total_bars = req.in_sample_bars + req.out_sample_bars
    fetch_limit = min(total_bars * req.windows + req.in_sample_bars, 1000)

    bars = await svc.get_ohlcv(req.symbol, interval=req.interval, limit=fetch_limit)

    if len(bars) < total_bars:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough bars: requested {total_bars} but only {len(bars)} available",
        )

    closes = [b["close"] for b in bars]

    def _simulate_pnl(bar_slice: List[float]) -> Dict[str, Any]:
        """Simple SMA crossover simulation on a price slice."""
        fast, slow = 10, 20
        if len(bar_slice) < slow:
            return {"total_pnl": 0.0, "trades": 0, "win_rate": 0.0, "sharpe": 0.0}

        fast_sma = [sum(bar_slice[i - fast:i]) / fast for i in range(fast, len(bar_slice))]
        slow_sma = [sum(bar_slice[i - slow:i]) / slow for i in range(slow, len(bar_slice))]
        aligned = min(len(fast_sma), len(slow_sma))
        fast_sma = fast_sma[-aligned:]
        slow_sma = slow_sma[-aligned:]

        pnls = []
        position = 0  # 1 long, -1 short, 0 flat
        entry_price = 0.0
        for i in range(1, aligned):
            prev_cross = fast_sma[i - 1] - slow_sma[i - 1]
            curr_cross = fast_sma[i] - slow_sma[i]
            price = bar_slice[slow + i]

            if prev_cross <= 0 and curr_cross > 0:  # cross up
                if position == -1:
                    pnls.append(entry_price - price)
                position = 1
                entry_price = price
            elif prev_cross >= 0 and curr_cross < 0:  # cross down
                if position == 1:
                    pnls.append(price - entry_price)
                position = -1
                entry_price = price

        if not pnls:
            return {"total_pnl": 0.0, "trades": 0, "win_rate": 0.0, "sharpe": 0.0}

        total_pnl = sum(pnls)
        wins = [p for p in pnls if p > 0]
        win_rate = len(wins) / len(pnls)
        mean_p = statistics.mean(pnls)
        std_p = statistics.stdev(pnls) if len(pnls) >= 2 else 0.0
        sharpe = (mean_p / std_p * math.sqrt(252)) if std_p > 0 else 0.0

        return {
            "total_pnl": round(total_pnl, 6),
            "trades": len(pnls),
            "win_rate": round(win_rate, 4),
            "sharpe": round(sharpe, 4),
        }

    windows_results = []
    offset = 0
    for w in range(req.windows):
        is_start = offset
        is_end = is_start + req.in_sample_bars
        oos_start = is_end
        oos_end = oos_start + req.out_sample_bars

        if oos_end > len(closes):
            break

        is_metrics = _simulate_pnl(closes[is_start:is_end])
        oos_metrics = _simulate_pnl(closes[oos_start:oos_end])

        windows_results.append({
            "window": w + 1,
            "in_sample": {
                "bar_range": [is_start, is_end],
                **is_metrics,
            },
            "out_of_sample": {
                "bar_range": [oos_start, oos_end],
                **oos_metrics,
            },
        })
        offset += req.out_sample_bars  # rolling step

    if not windows_results:
        raise HTTPException(status_code=400, detail="No complete windows could be formed")

    # Combined OOS stats
    oos_pnls = [w["out_of_sample"]["total_pnl"] for w in windows_results]
    combined_oos = {
        "total_pnl": round(sum(oos_pnls), 6),
        "avg_pnl_per_window": round(statistics.mean(oos_pnls), 6),
        "std_pnl": round(statistics.stdev(oos_pnls) if len(oos_pnls) >= 2 else 0.0, 6),
        "positive_windows": sum(1 for p in oos_pnls if p > 0),
        "total_windows": len(windows_results),
    }

    return {
        "strategy_id": req.strategy_id,
        "symbol": req.symbol,
        "interval": req.interval,
        "windows": windows_results,
        "combined_out_of_sample": combined_oos,
    }


# ---------------------------------------------------------------------------
# Correlation matrix
# ---------------------------------------------------------------------------

@router.get("/correlation")
async def correlation_matrix(
    symbols: str = Query(
        "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT",
        description="Comma-separated symbol list",
    ),
    interval: str = Query("1d"),
    limit: int = Query(90, ge=10, le=365),
    _user: dict = Depends(get_current_user),
):
    """
    Compute pairwise return correlation matrix for the given symbols.
    Uses daily (or custom interval) close prices from Binance.
    """
    import market_data_service as svc

    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if len(symbol_list) < 2:
        raise HTTPException(status_code=400, detail="At least 2 symbols required")
    if len(symbol_list) > 10:
        raise HTTPException(status_code=400, detail="Max 10 symbols")

    # Fetch close prices for all symbols concurrently
    import asyncio
    tasks = [svc.get_ohlcv(sym, interval=interval, limit=limit) for sym in symbol_list]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    price_series: Dict[str, List[float]] = {}
    for sym, bars in zip(symbol_list, results):
        if isinstance(bars, Exception) or not bars:
            price_series[sym] = []
        else:
            price_series[sym] = [b["close"] for b in bars]

    # Compute log returns and align lengths
    returns: Dict[str, List[float]] = {}
    for sym, prices in price_series.items():
        if len(prices) < 2:
            returns[sym] = []
        else:
            returns[sym] = [
                math.log(prices[i] / prices[i - 1])
                for i in range(1, len(prices))
                if prices[i - 1] > 0 and prices[i] > 0
            ]

    min_len = min((len(r) for r in returns.values() if r), default=0)
    if min_len < 2:
        raise HTTPException(status_code=400, detail="Not enough data to compute correlations")

    for sym in returns:
        returns[sym] = returns[sym][-min_len:]

    def _corr(x: List[float], y: List[float]) -> float:
        n = len(x)
        mx, my = statistics.mean(x), statistics.mean(y)
        num = sum((x[i] - mx) * (y[i] - my) for i in range(n))
        den = math.sqrt(
            sum((x[i] - mx) ** 2 for i in range(n))
            * sum((y[i] - my) ** 2 for i in range(n))
        )
        return round(num / den, 4) if den > 0 else 0.0

    matrix = []
    for sym_a in symbol_list:
        row = []
        for sym_b in symbol_list:
            if sym_a == sym_b:
                row.append(1.0)
            elif returns.get(sym_a) and returns.get(sym_b):
                row.append(_corr(returns[sym_a], returns[sym_b]))
            else:
                row.append(None)
        matrix.append(row)

    return {
        "symbols": symbol_list,
        "interval": interval,
        "bars_used": min_len,
        "matrix": matrix,
    }


# ---------------------------------------------------------------------------
# Position sizing calculator (Kelly / fixed-fraction)
# ---------------------------------------------------------------------------

class PositionSizeRequest(BaseModel):
    account_equity: float = Field(..., gt=0)
    win_rate: float = Field(..., ge=0, le=1)
    avg_win: float = Field(..., gt=0)
    avg_loss: float = Field(..., gt=0)
    risk_pct: float = Field(1.0, gt=0, le=100, description="Fixed-fraction risk %")


@router.post("/position-size")
async def calculate_position_size(req: PositionSizeRequest):
    """
    Calculate optimal position size using Kelly Criterion and fixed-fraction.
    """
    # Kelly fraction: f* = W/L - (1-W)/W_avg * (L_avg/W_avg)
    # Simplified: f* = (W * W_avg - (1-W) * L_avg) / W_avg
    kelly_f = (req.win_rate * req.avg_win - (1 - req.win_rate) * req.avg_loss) / req.avg_win
    kelly_f = max(0.0, kelly_f)

    # Half-Kelly (safer)
    half_kelly = kelly_f / 2

    # Fixed-fraction
    fixed_fraction = req.risk_pct / 100.0

    return {
        "account_equity": req.account_equity,
        "kelly_fraction": round(kelly_f, 4),
        "kelly_position": round(req.account_equity * kelly_f, 2),
        "half_kelly_fraction": round(half_kelly, 4),
        "half_kelly_position": round(req.account_equity * half_kelly, 2),
        "fixed_fraction": round(fixed_fraction, 4),
        "fixed_fraction_position": round(req.account_equity * fixed_fraction, 2),
        "recommendation": "half_kelly" if kelly_f > 0.25 else "kelly",
    }
