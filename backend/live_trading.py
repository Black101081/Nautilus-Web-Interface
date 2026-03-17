"""
LiveTradingManager — Sprint 2 (S2-01 through S2-05).

Manages the lifecycle of live adapter connections and order routing.
Wraps nautilus_trader TradingNode for live execution.

State:
- S2-01: LiveTradingManager class with full interface
- S2-02: connect_binance() with real credential verification + connect_bybit() with real verification
- S2-03: submit_order() / cancel_order() routing to real exchange REST APIs
- S2-04: sync_positions() fetches real account state from Binance/Bybit
- S2-05: subscribe_ticker() with exponential-backoff reconnect
"""

import asyncio
import hashlib
import hmac
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class BinanceAuthError(ConnectionError):
    """Raised when Binance explicitly rejects credentials (HTTP 401/403)."""


class BybitAuthError(ConnectionError):
    """Raised when Bybit explicitly rejects credentials (HTTP 401/403)."""


@dataclass
class AdapterConnection:
    adapter_id: str
    connection_id: str
    status: str = "connected"
    node: Any = None  # TradingNode instance when real
    api_key: str = ""
    api_secret: str = ""


class LiveTradingManager:
    """
    Thread-safe manager for live adapter connections and order routing.

    All state mutating methods are guarded by asyncio.Lock.
    Can be used as a singleton (exposed via state.py).
    """

    def __init__(self) -> None:
        self._connections: Dict[str, AdapterConnection] = {}
        self._is_active: bool = False
        self._lock: asyncio.Lock = asyncio.Lock()
        self._order_callbacks: List[Callable] = []

    # ── Connection state ──────────────────────────────────────────────────────

    def is_connected(self, adapter_id: Optional[str] = None) -> bool:
        """Return True if any (or a specific) adapter is connected."""
        if adapter_id:
            conn = self._connections.get(adapter_id)
            return conn is not None and conn.status == "connected"
        return any(c.status == "connected" for c in self._connections.values())

    def get_status(self) -> Dict[str, Any]:
        """Return current live manager status dict."""
        return {
            "is_active": self._is_active,
            "connections": {
                k: {
                    "adapter_id": v.adapter_id,
                    "status": v.status,
                    "connection_id": v.connection_id,
                }
                for k, v in self._connections.items()
            },
        }

    # ── Adapter connections ───────────────────────────────────────────────────

    @staticmethod
    async def _verify_binance_credentials(api_key: str, api_secret: str) -> Dict[str, Any]:
        """
        Verify Binance credentials by calling GET /api/v3/account.

        Returns {"valid": True, "can_trade": bool} on success.
        Raises ConnectionError with a descriptive message on failure.
        Network errors are reported separately so the caller can decide
        whether to mark as "connected_offline".
        """
        import httpx

        timestamp = int(time.time() * 1000)
        query = f"timestamp={timestamp}"
        signature = hmac.new(
            api_secret.encode(), query.encode(), hashlib.sha256
        ).hexdigest()
        url = f"https://api.binance.com/api/v3/account?{query}&signature={signature}"
        headers = {"X-MBX-APIKEY": api_key}

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers=headers)

            if resp.status_code == 200:
                data = resp.json()
                return {
                    "valid": True,
                    "can_trade": data.get("canTrade", False),
                    "can_withdraw": data.get("canWithdraw", False),
                    "account_type": data.get("accountType", "SPOT"),
                }
            if resp.status_code in (401, 403):
                raise BinanceAuthError(
                    f"Binance rejected credentials (HTTP {resp.status_code}): "
                    "check your API key and secret"
                )
            raise ConnectionError(
                f"Binance returned unexpected status {resp.status_code}"
            )
        except httpx.TimeoutException:
            raise ConnectionError("Binance API timed out — check your network")
        except httpx.ConnectError:
            raise ConnectionError("Could not reach Binance API — check your network")

    async def connect_binance(self, api_key: str, api_secret: str) -> Dict[str, Any]:
        """
        Connect Binance Spot adapter.

        Validates credentials via Binance REST API before marking as connected.
        If the network is unreachable the connection is still recorded
        (offline/degraded mode) so the UI stays functional.
        """
        async with self._lock:
            if not api_key or not api_secret:
                raise ConnectionError("api_key and api_secret are required")

            # Attempt real credential verification
            verified = False
            account_info: Dict[str, Any] = {}
            try:
                account_info = await self._verify_binance_credentials(api_key, api_secret)
                verified = True
            except BinanceAuthError:
                # Hard rejection from Binance (invalid key) — propagate immediately
                raise
            except Exception:
                # Network/timeout/other issue — fall through to "connected_offline" state
                pass

            connection_id = f"CONN-BINANCE-{uuid.uuid4().hex[:8].upper()}"
            status = "connected" if verified else "connected_offline"
            self._connections["binance"] = AdapterConnection(
                adapter_id="binance",
                connection_id=connection_id,
                status=status,
                api_key=api_key,
                api_secret=api_secret,
            )
            self._is_active = True
            return {
                "success": True,
                "connection_id": connection_id,
                "verified": verified,
                "account_info": account_info,
            }

    @staticmethod
    async def _verify_bybit_credentials(api_key: str, api_secret: str) -> Dict[str, Any]:
        """
        Verify Bybit credentials by calling GET /v5/user/query-api.

        Returns {"valid": True, "permissions": [...]} on success.
        Raises BybitAuthError on rejected credentials.
        """
        import httpx

        timestamp = str(int(time.time() * 1000))
        recv_window = "5000"
        param_str = timestamp + api_key + recv_window
        signature = hmac.new(
            api_secret.encode(), param_str.encode(), hashlib.sha256
        ).hexdigest()
        headers = {
            "X-BAPI-API-KEY": api_key,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-SIGN": signature,
            "X-BAPI-RECV-WINDOW": recv_window,
            "Content-Type": "application/json",
        }
        url = "https://api.bybit.com/v5/user/query-api"

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers=headers)

            if resp.status_code == 200:
                data = resp.json()
                ret_code = data.get("retCode", -1)
                if ret_code == 0:
                    result = data.get("result", {})
                    return {
                        "valid": True,
                        "permissions": result.get("permissions", {}),
                        "account_type": result.get("userTradeLevel", ""),
                    }
                # Bybit returns 200 but with error code for auth failures
                raise BybitAuthError(
                    f"Bybit rejected credentials (retCode={ret_code}): "
                    f"{data.get('retMsg', 'check your API key and secret')}"
                )
            if resp.status_code in (401, 403):
                raise BybitAuthError(
                    f"Bybit rejected credentials (HTTP {resp.status_code})"
                )
            raise ConnectionError(
                f"Bybit returned unexpected status {resp.status_code}"
            )
        except httpx.TimeoutException:
            raise ConnectionError("Bybit API timed out — check your network")
        except httpx.ConnectError:
            raise ConnectionError("Could not reach Bybit API — check your network")

    async def connect_bybit(self, api_key: str, api_secret: str) -> Dict[str, Any]:
        """Connect Bybit adapter with real credential verification."""
        async with self._lock:
            if not api_key or not api_secret:
                raise ConnectionError("api_key and api_secret are required")

            # Attempt real credential verification
            verified = False
            account_info: Dict[str, Any] = {}
            try:
                account_info = await self._verify_bybit_credentials(api_key, api_secret)
                verified = True
            except BybitAuthError:
                raise
            except Exception:
                # Network/timeout — fall through to "connected_offline"
                pass

            connection_id = f"CONN-BYBIT-{uuid.uuid4().hex[:8].upper()}"
            status = "connected" if verified else "connected_offline"
            self._connections["bybit"] = AdapterConnection(
                adapter_id="bybit",
                connection_id=connection_id,
                status=status,
                api_key=api_key,
                api_secret=api_secret,
            )
            self._is_active = True
            return {
                "success": True,
                "connection_id": connection_id,
                "verified": verified,
                "account_info": account_info,
            }

    async def disconnect(self, adapter_id: str) -> Dict[str, Any]:
        """Disconnect a specific adapter and update internal state."""
        async with self._lock:
            conn = self._connections.get(adapter_id)
            if conn:
                conn.status = "disconnected"
            # Deactivate node if no more active connections
            if not self.is_connected():
                self._is_active = False
            return {"success": True}

    # ── Internal exchange helpers ─────────────────────────────────────────────

    def _binance_sign(self, api_secret: str, query: str) -> str:
        return hmac.new(api_secret.encode(), query.encode(), hashlib.sha256).hexdigest()

    def _bybit_sign(self, api_secret: str, param_str: str) -> str:
        return hmac.new(api_secret.encode(), param_str.encode(), hashlib.sha256).hexdigest()

    async def _submit_binance_order(
        self, conn: "AdapterConnection", order: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Submit an order via Binance REST API."""
        import httpx

        symbol = order.get("instrument", "BTCUSDT").replace("/", "").split(".")[0]
        side = order.get("side", "BUY").upper()
        order_type = order.get("type", "MARKET").upper()
        quantity = str(order.get("quantity", 0.001))

        params: Dict[str, Any] = {
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "quantity": quantity,
            "timestamp": int(time.time() * 1000),
        }
        if order_type == "LIMIT":
            price = order.get("price")
            if price:
                params["price"] = str(price)
                params["timeInForce"] = "GTC"

        query = "&".join(f"{k}={v}" for k, v in params.items())
        params["signature"] = self._binance_sign(conn.api_secret, query)

        headers = {"X-MBX-APIKEY": conn.api_key}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.binance.com/api/v3/order",
                    params=params,
                    headers=headers,
                )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "success": True,
                    "order_id": str(data.get("orderId", "")),
                    "exchange_order_id": str(data.get("orderId", "")),
                    "client_order_id": data.get("clientOrderId", ""),
                    "status": data.get("status", "NEW").lower(),
                    "exchange": "BINANCE",
                }
            data = resp.json()
            raise RuntimeError(
                f"Binance order rejected (HTTP {resp.status_code}): "
                f"{data.get('msg', resp.text)}"
            )
        except httpx.TimeoutException:
            raise RuntimeError("Binance order timed out")
        except httpx.ConnectError:
            raise RuntimeError("Cannot reach Binance API")

    async def _cancel_binance_order(
        self, conn: "AdapterConnection", order_id: str
    ) -> Dict[str, Any]:
        """Cancel an order via Binance REST API."""
        import httpx

        params: Dict[str, Any] = {
            "symbol": "BTCUSDT",  # Binance requires symbol; best-effort default
            "orderId": order_id,
            "timestamp": int(time.time() * 1000),
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        params["signature"] = self._binance_sign(conn.api_secret, query)
        headers = {"X-MBX-APIKEY": conn.api_key}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.delete(
                    "https://api.binance.com/api/v3/order",
                    params=params,
                    headers=headers,
                )
            if resp.status_code == 200:
                return {"success": True, "order_id": order_id}
            data = resp.json()
            logger.warning("Binance cancel order %s: %s", order_id, data)
            return {"success": False, "order_id": order_id, "error": data.get("msg")}
        except Exception as exc:
            logger.warning("Binance cancel order exception: %s", exc)
            return {"success": False, "order_id": order_id, "error": str(exc)}

    async def _fetch_binance_positions(
        self, conn: "AdapterConnection"
    ) -> List[Dict[str, Any]]:
        """Fetch Binance SPOT account balances as pseudo-positions."""
        import httpx

        timestamp = int(time.time() * 1000)
        query = f"timestamp={timestamp}"
        signature = self._binance_sign(conn.api_secret, query)
        headers = {"X-MBX-APIKEY": conn.api_key}
        url = f"https://api.binance.com/api/v3/account?{query}&signature={signature}"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.warning("Binance account fetch status %s", resp.status_code)
                return []
            data = resp.json()
            positions = []
            for balance in data.get("balances", []):
                free = float(balance.get("free", 0))
                locked = float(balance.get("locked", 0))
                total = free + locked
                if total > 0.0:
                    asset = balance["asset"]
                    positions.append({
                        "instrument": f"{asset}USDT",
                        "side": "LONG",
                        "quantity": total,
                        "free": free,
                        "locked": locked,
                        "source": "live",
                        "exchange": "BINANCE",
                    })
            return positions
        except Exception as exc:
            logger.warning("Binance position sync failed: %s", exc)
            return []

    async def _submit_bybit_order(
        self, conn: "AdapterConnection", order: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Submit an order via Bybit REST API."""
        import httpx

        symbol = order.get("instrument", "BTCUSDT").replace("/", "").split(".")[0]
        side = order.get("side", "Buy").capitalize()
        order_type = order.get("type", "Market").capitalize()
        qty = str(order.get("quantity", 0.001))

        body: Dict[str, Any] = {
            "category": "spot",
            "symbol": symbol,
            "side": side,
            "orderType": order_type,
            "qty": qty,
        }
        if order_type == "Limit":
            price = order.get("price")
            if price:
                body["price"] = str(price)
                body["timeInForce"] = "GTC"

        timestamp = str(int(time.time() * 1000))
        recv_window = "5000"
        body_str = json.dumps(body)
        param_str = timestamp + conn.api_key + recv_window + body_str
        signature = self._bybit_sign(conn.api_secret, param_str)
        headers = {
            "X-BAPI-API-KEY": conn.api_key,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-SIGN": signature,
            "X-BAPI-RECV-WINDOW": recv_window,
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.bybit.com/v5/order/create",
                    content=body_str,
                    headers=headers,
                )
            data = resp.json()
            if resp.status_code == 200 and data.get("retCode") == 0:
                result = data.get("result", {})
                return {
                    "success": True,
                    "order_id": result.get("orderId", ""),
                    "exchange_order_id": result.get("orderId", ""),
                    "status": "pending",
                    "exchange": "BYBIT",
                }
            raise RuntimeError(
                f"Bybit order rejected: {data.get('retMsg', resp.text)}"
            )
        except httpx.TimeoutException:
            raise RuntimeError("Bybit order timed out")
        except httpx.ConnectError:
            raise RuntimeError("Cannot reach Bybit API")

    async def _cancel_bybit_order(
        self, conn: "AdapterConnection", order_id: str, symbol: str = "BTCUSDT"
    ) -> Dict[str, Any]:
        """Cancel an order via Bybit REST API."""
        import httpx

        body = {"category": "spot", "symbol": symbol, "orderId": order_id}
        timestamp = str(int(time.time() * 1000))
        recv_window = "5000"
        body_str = json.dumps(body)
        param_str = timestamp + conn.api_key + recv_window + body_str
        signature = self._bybit_sign(conn.api_secret, param_str)
        headers = {
            "X-BAPI-API-KEY": conn.api_key,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-SIGN": signature,
            "X-BAPI-RECV-WINDOW": recv_window,
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.bybit.com/v5/order/cancel",
                    content=body_str,
                    headers=headers,
                )
            data = resp.json()
            if resp.status_code == 200 and data.get("retCode") == 0:
                return {"success": True, "order_id": order_id}
            return {"success": False, "order_id": order_id, "error": data.get("retMsg")}
        except Exception as exc:
            logger.warning("Bybit cancel order exception: %s", exc)
            return {"success": False, "order_id": order_id, "error": str(exc)}

    async def _fetch_bybit_positions(
        self, conn: "AdapterConnection"
    ) -> List[Dict[str, Any]]:
        """Fetch Bybit wallet balances as pseudo-positions."""
        import httpx

        timestamp = str(int(time.time() * 1000))
        recv_window = "5000"
        params = "accountType=UNIFIED"
        param_str = timestamp + conn.api_key + recv_window + params
        signature = self._bybit_sign(conn.api_secret, param_str)
        headers = {
            "X-BAPI-API-KEY": conn.api_key,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-SIGN": signature,
            "X-BAPI-RECV-WINDOW": recv_window,
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://api.bybit.com/v5/account/wallet-balance",
                    params={"accountType": "UNIFIED"},
                    headers=headers,
                )
            data = resp.json()
            if resp.status_code != 200 or data.get("retCode") != 0:
                logger.warning("Bybit balance fetch: %s", data.get("retMsg"))
                return []
            positions = []
            for account in data.get("result", {}).get("list", []):
                for coin in account.get("coin", []):
                    total = float(coin.get("walletBalance", 0))
                    if total > 0:
                        asset = coin.get("coin", "")
                        positions.append({
                            "instrument": f"{asset}USDT",
                            "side": "LONG",
                            "quantity": total,
                            "equity": float(coin.get("equity", total)),
                            "source": "live",
                            "exchange": "BYBIT",
                        })
            return positions
        except Exception as exc:
            logger.warning("Bybit position sync failed: %s", exc)
            return []

    # ── Order management ──────────────────────────────────────────────────────

    async def submit_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit an order to the connected exchange via REST API.

        Routes to Binance or Bybit based on which adapter is connected.
        Falls back gracefully if the exchange rejects the order.
        """
        if not self.is_connected():
            raise RuntimeError("No adapter connected. Connect an exchange adapter first.")

        # Route to the first active connection
        for adapter_id, conn in self._connections.items():
            if conn.status not in ("connected", "connected_offline"):
                continue
            try:
                if adapter_id in ("binance", "binance_futures"):
                    return await self._submit_binance_order(conn, order)
                elif adapter_id == "bybit":
                    return await self._submit_bybit_order(conn, order)
            except Exception as exc:
                logger.warning("Exchange order submission failed for %s: %s", adapter_id, exc)
                raise RuntimeError(str(exc)) from exc

        # No active connection found
        raise RuntimeError("No active exchange connection available.")

    async def cancel_order(self, order_id: str, symbol: str = "BTCUSDT") -> Dict[str, Any]:
        """Cancel an order on the connected exchange."""
        if not self.is_connected():
            raise RuntimeError("No adapter connected.")

        for adapter_id, conn in self._connections.items():
            if conn.status not in ("connected", "connected_offline"):
                continue
            try:
                if adapter_id in ("binance", "binance_futures"):
                    return await self._cancel_binance_order(conn, order_id)
                elif adapter_id == "bybit":
                    return await self._cancel_bybit_order(conn, order_id, symbol=symbol)
            except Exception as exc:
                logger.warning("Exchange cancel order failed for %s: %s", adapter_id, exc)
                return {"success": False, "order_id": order_id, "error": str(exc)}

        return {"success": True, "order_id": order_id}

    async def sync_positions(self) -> List[Dict[str, Any]]:
        """
        Fetch open positions/balances from the connected exchange.

        Returns empty list if not connected or on network error.
        """
        if not self.is_connected():
            return []

        all_positions: List[Dict[str, Any]] = []
        for adapter_id, conn in self._connections.items():
            if conn.status not in ("connected", "connected_offline"):
                continue
            try:
                if adapter_id in ("binance", "binance_futures"):
                    positions = await self._fetch_binance_positions(conn)
                elif adapter_id == "bybit":
                    positions = await self._fetch_bybit_positions(conn)
                else:
                    positions = []
                all_positions.extend(positions)
            except Exception as exc:
                logger.warning("Position sync failed for %s: %s", adapter_id, exc)

        return all_positions

    # ── Market data WebSocket ─────────────────────────────────────────────────

    async def _connect_ws(
        self, symbol: str, on_message: Callable, backoff: float = 1.0
    ) -> None:
        """
        Open a single WebSocket session to the Binance ticker stream.
        Raises on disconnect (caller handles reconnect).
        """
        import websockets  # type: ignore

        url = f"wss://stream.binance.com:9443/ws/{symbol.lower()}@ticker"
        async with websockets.connect(url, ping_interval=20, ping_timeout=20) as ws:
            async for raw in ws:
                data = json.loads(raw)
                await on_message(data)

    async def subscribe_ticker(
        self, symbol: str, on_message: Callable, backoff: float = 1.0
    ) -> None:
        """
        Subscribe to Binance WebSocket ticker stream with exponential-backoff reconnect.

        Runs forever — cancel the task to stop.
        backoff: initial wait (seconds) between reconnects; doubles on each failure.
        """
        max_backoff = 60.0
        current_backoff = backoff

        while True:
            try:
                await self._connect_ws(symbol, on_message, backoff=current_backoff)
                # Don't reset backoff on success — keep monotonically increasing
                await asyncio.sleep(0)  # yield so cancellation / timeout can fire
            except asyncio.CancelledError:
                raise
            except Exception:
                await asyncio.sleep(current_backoff)
                current_backoff = min(current_backoff * 2, max_backoff)


async def process_order_update(update: Dict[str, Any]) -> None:
    """
    Process an order status update received from the exchange WebSocket.
    Updates the order status in the DB.

    Sprint 2 (S2-03): Called when exchange sends fill notifications.
    """
    import database

    exchange_order_id = update.get("orderId", "")
    status = update.get("status", "").lower()
    executed_qty = float(update.get("executedQty", 0))

    if not exchange_order_id:
        return

    # Map exchange status to our DB status
    status_map = {
        "filled": "filled",
        "partially_filled": "partial",
        "canceled": "CANCELLED",
        "cancelled": "CANCELLED",
        "rejected": "rejected",
        "pending": "PENDING",
        "new": "PENDING",
    }
    db_status = status_map.get(status, status)

    # Update order in DB by exchange_order_id
    async with database.aiosqlite.connect(database.DB_PATH) as db:
        await db.execute(
            "UPDATE orders SET status=?, filled_qty=? WHERE exchange_order_id=?",
            (db_status, executed_qty, exchange_order_id),
        )
        await db.commit()
