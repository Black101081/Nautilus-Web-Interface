"""
Async SQLite persistence for orders, alerts, risk limits, and settings.
Replaces the in-memory dicts that were lost on every server restart.
"""

import json
import os
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiosqlite

DB_PATH = Path(__file__).parent / "data" / "nautilus.db"

# ── Default values ────────────────────────────────────────────────────────────

DEFAULT_RISK_LIMITS: Dict[str, Any] = {
    "max_position_size": 100_000,
    "max_daily_loss": 5_000,
    "max_drawdown_pct": 15.0,
    "max_leverage": 10,
    "max_orders_per_day": 1_000,
}

DEFAULT_SETTINGS: Dict[str, Any] = {
    "general": {
        "system_name": "Nautilus Trader",
        "environment": "Development",
    },
    "notifications": {
        "email_enabled": False,
        "email_to": "",
        "smtp_host": "",
        "smtp_port": 587,
        "smtp_user": "",
        "smtp_password": "",
        "smtp_from": "",
        "telegram_enabled": False,
        "telegram_bot_token": "",
        "telegram_chat_id": "",
        "slack_enabled": False,
        "sms_enabled": False,
    },
    "security": {
        "session_timeout": 30,
        "two_factor_auth": False,
    },
    "performance": {
        "max_concurrent_requests": 100,
        "cache_ttl": 3600,
    },
}


# ── Schema ────────────────────────────────────────────────────────────────────

async def init_db() -> None:
    """Create all tables if they don't exist and seed defaults."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id                  TEXT PRIMARY KEY,
                instrument          TEXT NOT NULL,
                side                TEXT NOT NULL,
                type                TEXT NOT NULL DEFAULT 'MARKET',
                quantity            REAL NOT NULL DEFAULT 0,
                price               REAL,
                status              TEXT NOT NULL DEFAULT 'PENDING',
                filled_qty          REAL NOT NULL DEFAULT 0,
                pnl                 REAL DEFAULT 0,
                strategy_id         TEXT,
                exchange_order_id   TEXT,
                timestamp           TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id          TEXT PRIMARY KEY,
                symbol      TEXT NOT NULL,
                condition   TEXT NOT NULL,
                price       REAL NOT NULL,
                message     TEXT NOT NULL DEFAULT '',
                status      TEXT NOT NULL DEFAULT 'active',
                created_at  TEXT NOT NULL,
                triggered_at TEXT
            );

            CREATE TABLE IF NOT EXISTS kv_store (
                namespace   TEXT NOT NULL,
                key         TEXT NOT NULL,
                value       TEXT NOT NULL,
                PRIMARY KEY (namespace, key)
            );

            CREATE TABLE IF NOT EXISTS strategies (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                type        TEXT NOT NULL DEFAULT 'sma_crossover',
                status      TEXT NOT NULL DEFAULT 'stopped',
                description TEXT NOT NULL DEFAULT '',
                config      TEXT NOT NULL DEFAULT '{}',
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS positions (
                id          TEXT PRIMARY KEY,
                instrument  TEXT NOT NULL,
                side        TEXT NOT NULL,
                quantity    REAL NOT NULL DEFAULT 0,
                entry_price REAL,
                exit_price  REAL,
                pnl         REAL DEFAULT 0,
                is_open     INTEGER NOT NULL DEFAULT 1,
                strategy_id TEXT,
                opened_at   TEXT NOT NULL,
                closed_at   TEXT
            );

            CREATE TABLE IF NOT EXISTS adapter_configs (
                adapter_id      TEXT PRIMARY KEY,
                api_key         TEXT,
                api_secret      TEXT,
                status          TEXT NOT NULL DEFAULT 'disconnected',
                last_connected  TEXT,
                extra_config    TEXT DEFAULT '{}',
                updated_at      TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS component_states (
                component_id    TEXT PRIMARY KEY,
                status          TEXT NOT NULL DEFAULT 'stopped',
                updated_at      TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id              TEXT PRIMARY KEY,
                username        TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role            TEXT NOT NULL DEFAULT 'trader',
                is_active       INTEGER NOT NULL DEFAULT 1,
                created_at      TEXT NOT NULL,
                totp_secret     TEXT,
                two_factor_enabled INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id          TEXT PRIMARY KEY,
                user_id     TEXT,
                action      TEXT NOT NULL,
                resource    TEXT,
                details     TEXT,
                ip_address  TEXT,
                timestamp   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS revoked_tokens (
                jti         TEXT PRIMARY KEY,
                revoked_at  TEXT NOT NULL,
                expires_at  TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);

            CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp);
            CREATE INDEX IF NOT EXISTS idx_alerts_symbol    ON alerts(symbol);
            CREATE INDEX IF NOT EXISTS idx_alerts_status    ON alerts(status);
            CREATE INDEX IF NOT EXISTS idx_strategies_status     ON strategies(status);
            CREATE INDEX IF NOT EXISTS idx_strategies_created_at ON strategies(created_at);
            CREATE INDEX IF NOT EXISTS idx_positions_is_open     ON positions(is_open);
            CREATE INDEX IF NOT EXISTS idx_positions_strategy_id ON positions(strategy_id);
            """
        )
        await db.commit()

        # Idempotent column migrations
        for migration in [
            "ALTER TABLE orders ADD COLUMN pnl REAL DEFAULT 0",
            "ALTER TABLE orders ADD COLUMN strategy_id TEXT",
            "ALTER TABLE orders ADD COLUMN exchange_order_id TEXT",
            "ALTER TABLE orders ADD COLUMN avg_px REAL",
            "ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'web'",
            "ALTER TABLE orders ADD COLUMN client_order_id TEXT",
            "ALTER TABLE positions ADD COLUMN source TEXT DEFAULT 'web'",
            "ALTER TABLE users ADD COLUMN totp_secret TEXT",
            "ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0",
        ]:
            try:
                await db.execute(migration)
                await db.commit()
            except aiosqlite.OperationalError:
                pass  # Column already exists — expected on re-initialization

        await _seed_defaults(db)

    # Seed admin user outside the schema transaction (needs own connection)
    admin_pw = os.getenv("ADMIN_PASSWORD", "admin")
    await seed_admin_user(admin_pw)


async def _seed_defaults(db: aiosqlite.Connection) -> None:
    """Populate kv_store with defaults if they don't exist yet."""
    # Single query: which namespaces already have rows?
    async with db.execute(
        "SELECT namespace FROM kv_store WHERE namespace IN ('risk', 'settings') GROUP BY namespace"
    ) as cur:
        existing = {row[0] for row in await cur.fetchall()}

    if "risk" not in existing:
        await db.execute(
            "INSERT INTO kv_store (namespace, key, value) VALUES ('risk', 'limits', ?)",
            (json.dumps(DEFAULT_RISK_LIMITS),),
        )

    if "settings" not in existing:
        for section, values in DEFAULT_SETTINGS.items():
            await db.execute(
                "INSERT INTO kv_store (namespace, key, value) VALUES ('settings', ?, ?)",
                (section, json.dumps(values)),
            )

    await db.commit()


# ── Orders ────────────────────────────────────────────────────────────────────

async def list_orders() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM orders ORDER BY timestamp DESC LIMIT 200") as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def create_order(
    instrument: str,
    side: str,
    order_type: str = "MARKET",
    quantity: float = 0.0,
    price: Optional[float] = None,
) -> Dict[str, Any]:
    order = {
        "id": f"ORD-{uuid.uuid4().hex[:8].upper()}",
        "instrument": instrument,
        "side": side,
        "type": order_type,
        "quantity": quantity,
        "price": price,
        "status": "PENDING",
        "filled_qty": 0.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO orders (id, instrument, side, type, quantity, price, status, filled_qty, timestamp)
            VALUES (:id, :instrument, :side, :type, :quantity, :price, :status, :filled_qty, :timestamp)
            """,
            order,
        )
        await db.commit()
    return order


async def cancel_order(order_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE orders SET status='CANCELLED' WHERE id=? AND status='PENDING'",
            (order_id,),
        )
        await db.commit()
        return cur.rowcount > 0


# ── Alerts ────────────────────────────────────────────────────────────────────

async def list_alerts() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM alerts ORDER BY created_at DESC") as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def create_alert(
    symbol: str,
    condition: str,
    price: float,
    message: str = "",
) -> Dict[str, Any]:
    alert = {
        "id": f"ALT-{uuid.uuid4().hex[:8].upper()}",
        "symbol": symbol,
        "condition": condition,
        "price": price,
        "message": message,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "triggered_at": None,
    }
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO alerts (id, symbol, condition, price, message, status, created_at, triggered_at)
            VALUES (:id, :symbol, :condition, :price, :message, :status, :created_at, :triggered_at)
            """,
            alert,
        )
        await db.commit()
    return alert


async def list_active_alerts() -> List[Dict[str, Any]]:
    """Return only alerts with status='active' (not yet triggered)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM alerts WHERE status='active' ORDER BY created_at DESC"
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def trigger_alert(alert_id: str) -> bool:
    """Mark alert as triggered with current timestamp. Returns True if updated."""
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE alerts SET status='triggered', triggered_at=? WHERE id=? AND status='active'",
            (now, alert_id),
        )
        await db.commit()
        updated = cur.rowcount > 0

    if updated:
        # Fetch alert and send notifications (best-effort)
        try:
            alert = await _get_alert_by_id(alert_id)
            if alert:
                import notifications  # lazy import to avoid circular at module load
                await notifications.notify_alert_triggered(alert)
        except Exception:
            pass  # Notifications are best-effort; never crash the trigger

    return updated


async def dismiss_alert(alert_id: str) -> bool:
    """Mark alert as dismissed (active → dismissed only). Returns True if updated."""
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE alerts SET status='dismissed' WHERE id=? AND status='active'",
            (alert_id,),
        )
        await db.commit()
        return cur.rowcount > 0


async def delete_alert(alert_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("DELETE FROM alerts WHERE id=?", (alert_id,))
        await db.commit()
        return cur.rowcount > 0


# ── Risk limits ───────────────────────────────────────────────────────────────

async def get_risk_limits() -> Dict[str, Any]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT value FROM kv_store WHERE namespace='risk' AND key='limits'"
        ) as cur:
            row = await cur.fetchone()
    if not row:
        return DEFAULT_RISK_LIMITS.copy()
    try:
        return json.loads(row[0])
    except (json.JSONDecodeError, TypeError):
        return DEFAULT_RISK_LIMITS.copy()


async def risk_limits_explicitly_set() -> bool:
    """Return True if risk limits have been explicitly configured by the user (not just seeded defaults)."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT 1 FROM kv_store WHERE namespace='risk' AND key='user_configured'"
        ) as cur:
            row = await cur.fetchone()
    return row is not None


async def update_risk_limits(updates: Dict[str, Any]) -> Dict[str, Any]:
    limits = await get_risk_limits()
    limits.update(updates)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO kv_store (namespace, key, value) VALUES ('risk', 'limits', ?)",
            (json.dumps(limits),),
        )
        # Mark that limits have been explicitly configured by the user
        await db.execute(
            "INSERT OR REPLACE INTO kv_store (namespace, key, value) VALUES ('risk', 'user_configured', '1')",
        )
        await db.commit()
    return limits


# ── Settings ──────────────────────────────────────────────────────────────────

_SENSITIVE_SETTINGS_FIELDS = ("smtp_password", "telegram_bot_token")


def _encrypt_sensitive_settings(notif: dict) -> dict:
    """Return a copy of notif with sensitive fields encrypted."""
    from credential_utils import encrypt_credential
    result = dict(notif)
    for field in _SENSITIVE_SETTINGS_FIELDS:
        if field in result and result[field]:
            result[field] = encrypt_credential(result[field])
    return result


def _decrypt_sensitive_settings(notif: dict) -> dict:
    """Return a copy of notif with sensitive fields decrypted (for internal use)."""
    from credential_utils import decrypt_credential
    result = dict(notif)
    for field in _SENSITIVE_SETTINGS_FIELDS:
        if field in result and result[field]:
            decrypted = decrypt_credential(result[field])
            # On failure return empty string — never expose raw encrypted bytes as credential
            result[field] = decrypted if decrypted else ""
    return result


def _mask_sensitive_settings(notif: dict) -> dict:
    """Return a copy of notif with sensitive fields masked for API responses."""
    result = dict(notif)
    for field in _SENSITIVE_SETTINGS_FIELDS:
        if field in result and result[field]:
            result[field] = "****"
    return result


async def get_settings(mask_sensitive: bool = True) -> Dict[str, Any]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT key, value FROM kv_store WHERE namespace='settings'"
        ) as cur:
            rows = await cur.fetchall()
    if not rows:
        return DEFAULT_SETTINGS.copy()
    result = {key: json.loads(value) for key, value in rows}
    if mask_sensitive and "notifications" in result:
        result["notifications"] = _mask_sensitive_settings(result["notifications"])
    return result


async def get_settings_raw() -> Dict[str, Any]:
    """Return settings with decrypted sensitive fields (for internal notification use)."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT key, value FROM kv_store WHERE namespace='settings'"
        ) as cur:
            rows = await cur.fetchall()
    if not rows:
        return DEFAULT_SETTINGS.copy()
    result = {key: json.loads(value) for key, value in rows}
    if "notifications" in result:
        result["notifications"] = _decrypt_sensitive_settings(result["notifications"])
    return result


async def update_settings(body: Dict[str, Any]) -> Dict[str, Any]:
    settings = await get_settings(mask_sensitive=False)
    # Decrypt existing encrypted fields before merging
    if "notifications" in settings:
        settings["notifications"] = _decrypt_sensitive_settings(settings["notifications"])
    for section, values in body.items():
        if isinstance(values, dict):
            if section in settings:
                settings[section].update(values)
            else:
                settings[section] = values
    # Encrypt sensitive notification fields before storing
    if "notifications" in settings:
        settings["notifications"] = _encrypt_sensitive_settings(settings["notifications"])
    async with aiosqlite.connect(DB_PATH) as db:
        for section, values in settings.items():
            await db.execute(
                "INSERT OR REPLACE INTO kv_store (namespace, key, value) VALUES ('settings', ?, ?)",
                (section, json.dumps(values)),
            )
        await db.commit()
    # Return masked version
    result = dict(settings)
    if "notifications" in result:
        result["notifications"] = _mask_sensitive_settings(result["notifications"])
    return result


# ── Strategies ────────────────────────────────────────────────────────────────

async def list_strategies() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM strategies ORDER BY created_at DESC") as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def save_strategy(strategy: Dict[str, Any]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT OR REPLACE INTO strategies
                (id, name, type, status, description, config, created_at, updated_at)
            VALUES (:id, :name, :type, :status, :description, :config, :created_at, :updated_at)
            """,
            {
                "id": strategy["id"],
                "name": strategy["name"],
                "type": strategy.get("type", "sma_crossover"),
                "status": strategy.get("status", "stopped"),
                "description": strategy.get("description", ""),
                "config": json.dumps(strategy.get("config", {})),
                "created_at": strategy.get("created_at", now),
                "updated_at": now,
            },
        )
        await db.commit()


async def update_strategy_status(strategy_id: str, status: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE strategies SET status = ?, updated_at = ? WHERE id = ?",
            (status, datetime.now(timezone.utc).isoformat(), strategy_id),
        )
        await db.commit()
        return cur.rowcount > 0


async def delete_strategy(strategy_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("DELETE FROM strategies WHERE id = ?", (strategy_id,))
        await db.commit()
        return cur.rowcount > 0


# ── Positions ─────────────────────────────────────────────────────────────────

async def list_db_positions(open_only: bool = True) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        query = "SELECT * FROM positions"
        if open_only:
            query += " WHERE is_open = 1"
        query += " ORDER BY opened_at DESC LIMIT 200"
        async with db.execute(query) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def save_positions(positions: List[Dict[str, Any]], strategy_id: str = "") -> None:
    """Upsert a list of position dicts (from backtest results) into DB."""
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        for p in positions:
            await db.execute(
                """
                INSERT OR REPLACE INTO positions
                    (id, instrument, side, quantity, entry_price, exit_price,
                     pnl, is_open, strategy_id, opened_at, closed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    p.get("id", f"POS-{uuid.uuid4().hex[:8].upper()}"),
                    p.get("instrument", "UNKNOWN"),
                    p.get("side", "LONG"),
                    float(p.get("quantity", 0)),
                    p.get("entry_price"),
                    p.get("exit_price"),
                    float(p.get("pnl", 0)),
                    1 if p.get("is_open", False) else 0,
                    strategy_id,
                    p.get("opened_at", now),
                    p.get("closed_at"),
                ),
            )
        await db.commit()


async def close_db_position(position_id: str) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE positions SET is_open = 0, closed_at = ? WHERE id = ?",
            (now, position_id),
        )
        await db.commit()
        return cur.rowcount > 0


# ── Adapter configs ───────────────────────────────────────────────────────────

async def get_adapter_config(adapter_id: str) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM adapter_configs WHERE adapter_id = ?", (adapter_id,)
        ) as cur:
            row = await cur.fetchone()
    return dict(row) if row else None


async def upsert_adapter_config(
    adapter_id: str,
    status: str,
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
    extra_config: Optional[Dict] = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    last_connected = now if status == "connected" else None
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO adapter_configs
                (adapter_id, api_key, api_secret, status, last_connected, extra_config, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(adapter_id) DO UPDATE SET
                api_key        = excluded.api_key,
                api_secret     = excluded.api_secret,
                status         = excluded.status,
                last_connected = COALESCE(excluded.last_connected, last_connected),
                extra_config   = excluded.extra_config,
                updated_at     = excluded.updated_at
            """,
            (
                adapter_id,
                api_key,
                api_secret,
                status,
                last_connected,
                json.dumps(extra_config or {}),
                now,
            ),
        )
        await db.commit()


# ── Component states ──────────────────────────────────────────────────────────

async def get_component_states() -> Dict[str, str]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT component_id, status FROM component_states") as cur:
            rows = await cur.fetchall()
    return {row[0]: row[1] for row in rows}


async def set_component_state(component_id: str, status: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO component_states (component_id, status, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(component_id) DO UPDATE SET
                status     = excluded.status,
                updated_at = excluded.updated_at
            """,
            (component_id, status, now),
        )
        await db.commit()


# ── Low-level helpers ──────────────────────────────────────────────────────────

async def _execute(sql: str, params: tuple = (), *, commit: bool = False) -> None:
    """Execute a raw SQL statement. Used by tests to inject test data."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(sql, params)
        if commit:
            await db.commit()


async def _get_alert_by_id(alert_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single alert by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM alerts WHERE id=?", (alert_id,)) as cur:
            row = await cur.fetchone()
    return dict(row) if row else None


# ── Adapter helpers ────────────────────────────────────────────────────────────

async def has_connected_adapter() -> bool:
    """Return True if any adapter in DB has status='connected'."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT COUNT(*) FROM adapter_configs WHERE status='connected'"
        ) as cur:
            row = await cur.fetchone()
    return (row[0] if row else 0) > 0


# ── Risk helpers ───────────────────────────────────────────────────────────────

async def get_daily_realized_loss() -> float:
    """
    Return the total realized loss from filled orders today (UTC).
    Loss is a negative number; we return its absolute value is implied by callers.
    """
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            """SELECT COALESCE(SUM(pnl), 0) FROM orders
               WHERE status='filled' AND date(timestamp)=? AND pnl < 0""",
            (today,),
        ) as cur:
            row = await cur.fetchone()
    return float(row[0]) if row and row[0] is not None else 0.0


async def count_orders_today() -> int:
    """Return the number of orders created today (UTC)."""
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT COUNT(*) FROM orders WHERE date(timestamp)=?",
            (today,),
        ) as cur:
            row = await cur.fetchone()
    return int(row[0]) if row and row[0] is not None else 0


# ── Live-node helpers (upsert by NautilusTrader IDs) ──────────────────────────

async def upsert_order_by_client_id(
    client_order_id: str,
    instrument: str,
    side: str,
    order_type: str,
    quantity: float,
    price: Optional[float],
    status: str,
    exchange_order_id: Optional[str] = None,
    filled_qty: float = 0.0,
    avg_px: Optional[float] = None,
    source: str = "live_node",
) -> None:
    """
    Upsert an order using its NautilusTrader client_order_id as the lookup key.
    Creates a new row if not found; updates status/fill fields if found.
    """
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        # Check if already exists by client_order_id
        async with db.execute(
            "SELECT id FROM orders WHERE client_order_id = ?", (client_order_id,)
        ) as cur:
            row = await cur.fetchone()

        if row:
            await db.execute(
                """UPDATE orders SET status=?, filled_qty=?, avg_px=?,
                   exchange_order_id=COALESCE(?, exchange_order_id)
                   WHERE client_order_id=?""",
                (status, filled_qty, avg_px, exchange_order_id, client_order_id),
            )
        else:
            order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
            await db.execute(
                """INSERT INTO orders
                   (id, client_order_id, instrument, side, type, quantity, price,
                    status, filled_qty, avg_px, exchange_order_id, timestamp, source)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    order_id, client_order_id, instrument, side, order_type,
                    quantity, price, status, filled_qty, avg_px, exchange_order_id,
                    now, source,
                ),
            )
        await db.commit()


async def upsert_position_by_id(
    position_id: str,
    instrument: str,
    side: str,
    quantity: float,
    entry_price: float,
    is_open: bool,
    exit_price: Optional[float] = None,
    realized_pnl: float = 0.0,
    source: str = "live_node",
) -> None:
    """
    Upsert a position using its NautilusTrader position_id.
    """
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id FROM positions WHERE id = ?", (position_id,)
        ) as cur:
            row = await cur.fetchone()

        if row:
            await db.execute(
                """UPDATE positions SET quantity=?, exit_price=?, pnl=?, is_open=?,
                   closed_at=CASE WHEN ? = 0 THEN ? ELSE closed_at END, source=?
                   WHERE id=?""",
                (quantity, exit_price, realized_pnl, 1 if is_open else 0,
                 1 if is_open else 0, now, source, position_id),
            )
        else:
            await db.execute(
                """INSERT INTO positions
                   (id, instrument, side, quantity, entry_price, exit_price, pnl,
                    is_open, opened_at, source)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    position_id, instrument, side, quantity, entry_price,
                    exit_price, realized_pnl, 1 if is_open else 0, now, source,
                ),
            )
        await db.commit()


# ── Users ──────────────────────────────────────────────────────────────────────

async def get_user(username: str) -> Optional[Dict[str, Any]]:
    """Fetch a user by username (active only)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE username=? AND is_active=1", (username,)
        ) as cur:
            row = await cur.fetchone()
    return dict(row) if row else None


async def list_users() -> List[Dict[str, Any]]:
    """Return all users (hashed_password excluded)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, username, role, is_active, created_at FROM users ORDER BY created_at"
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def create_user(username: str, hashed_password: str, role: str = "trader") -> Dict[str, Any]:
    """Insert a new user; raises ValueError if username already exists."""
    user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
    created_at = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            await db.execute(
                """INSERT INTO users (id, username, hashed_password, role, is_active, created_at)
                   VALUES (?, ?, ?, ?, 1, ?)""",
                (user_id, username, hashed_password, role, created_at),
            )
            await db.commit()
        except aiosqlite.IntegrityError:
            raise ValueError(f"Username '{username}' already exists")
    return {"id": user_id, "username": username, "role": role, "is_active": 1, "created_at": created_at}


async def delete_user(user_id: str) -> bool:
    """Soft-delete a user (set is_active=0). Returns True if found."""
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE users SET is_active=0 WHERE id=? AND is_active=1", (user_id,)
        )
        await db.commit()
        return cur.rowcount > 0


async def update_user_password(user_id: str, hashed_password: str) -> bool:
    """Update a user's hashed password. Returns True if found."""
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE users SET hashed_password=? WHERE id=? AND is_active=1",
            (hashed_password, user_id),
        )
        await db.commit()
        return cur.rowcount > 0


async def seed_admin_user(admin_password: str) -> None:
    """Ensure the admin user exists in the DB; creates it if absent."""
    import bcrypt as _bcrypt
    existing = await get_user("admin")
    if not existing:
        hashed = _bcrypt.hashpw(admin_password.encode(), _bcrypt.gensalt()).decode()
        try:
            await create_user("admin", hashed, role="admin")
        except ValueError:
            pass  # Race condition: another process inserted admin first


async def get_user_2fa(username: str) -> Optional[Dict[str, Any]]:
    """Return totp_secret + two_factor_enabled for a user (active only)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, username, totp_secret, two_factor_enabled FROM users WHERE username=? AND is_active=1",
            (username,),
        ) as cur:
            row = await cur.fetchone()
    return dict(row) if row else None


async def set_totp_secret(username: str, secret: str) -> None:
    """Store a new (unconfirmed) TOTP secret for a user."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET totp_secret=? WHERE username=? AND is_active=1",
            (secret, username),
        )
        await db.commit()


async def enable_2fa(username: str) -> bool:
    """Activate 2FA for a user (secret must already be set). Returns True if found."""
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE users SET two_factor_enabled=1 WHERE username=? AND is_active=1 AND totp_secret IS NOT NULL",
            (username,),
        )
        await db.commit()
        return cur.rowcount > 0


async def disable_2fa(username: str) -> bool:
    """Deactivate 2FA and clear secret. Returns True if found."""
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE users SET two_factor_enabled=0, totp_secret=NULL WHERE username=? AND is_active=1",
            (username,),
        )
        await db.commit()
        return cur.rowcount > 0


# ── Audit log ──────────────────────────────────────────────────────────────────

async def log_action(
    action: str,
    user_id: str = "",
    resource: str = "",
    details: str = "",
    ip_address: str = "",
) -> None:
    """Append an audit log entry."""
    import uuid as _uuid
    entry = {
        "id": f"AUD-{_uuid.uuid4().hex[:8].upper()}",
        "user_id": user_id,
        "action": action,
        "resource": resource,
        "details": details,
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO audit_logs (id, user_id, action, resource, details, ip_address, timestamp)
               VALUES (:id, :user_id, :action, :resource, :details, :ip_address, :timestamp)""",
            entry,
        )
        await db.commit()


async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    user_id: str = "",
    action: str = "",
) -> list:
    """Return audit log entries, optionally filtered by user_id or action."""
    conditions = []
    params: list = []
    if user_id:
        conditions.append("user_id = ?")
        params.append(user_id)
    if action:
        conditions.append("action = ?")
        params.append(action)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params += [limit, offset]
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            f"SELECT * FROM audit_logs {where} ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            params,
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


# ── Token revocation (persistent blacklist) ───────────────────────────────────

async def revoke_token(jti: str, expires_at: str) -> None:
    """Persist a revoked JWT JTI so it stays invalid across restarts."""
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR IGNORE INTO revoked_tokens (jti, revoked_at, expires_at) VALUES (?, ?, ?)",
            (jti, now, expires_at),
        )
        await db.commit()


async def is_token_revoked(jti: str) -> bool:
    """Return True if the JTI has been revoked and has not yet expired."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT 1 FROM revoked_tokens WHERE jti=? AND expires_at > ?",
            (jti, datetime.now(timezone.utc).isoformat()),
        ) as cur:
            return await cur.fetchone() is not None


async def purge_expired_revoked_tokens() -> int:
    """Delete expired tokens from the blacklist. Returns count removed."""
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "DELETE FROM revoked_tokens WHERE expires_at <= ?",
            (datetime.now(timezone.utc).isoformat(),),
        )
        await db.commit()
        return cur.rowcount
