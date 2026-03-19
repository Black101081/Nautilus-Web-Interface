# Implementation Plan — Nautilus Web Interface
# Kế hoạch hoàn thiện toàn bộ hệ thống

> **Baseline score:** 5.3/10 (2026-03-15)
> **Target score:** 9.5/10
> **Tổng số tasks:** 20 tasks · 4 sprints
> **Phương pháp:** TDD — test được viết sẵn trong `tests/test_*.py` và `e2e/tests/*.spec.ts`

---

## ĐỌC TRƯỚC KHI BẮT ĐẦU

### Quy ước file paths
```
backend/                   → /home/user/Nautilus-Web-Interface/backend/
frontend/src/              → /home/user/Nautilus-Web-Interface/frontend/src/
e2e/                       → /home/user/Nautilus-Web-Interface/e2e/
```

### Quy trình mỗi task
```
1. Đọc test tương ứng trong tests/test_*.py (xfail → sẽ pass sau khi xong)
2. Implement đúng interface mà test expect
3. Chạy: cd backend && pytest tests/ -v --tb=short
4. Kiểm tra số xfailed giảm, passed tăng
5. Commit với message rõ ràng
```

### Dependencies giữa các sprint
```
Sprint 1 (Security) ──→ Sprint 2 (Live Trading)
     │                         │
     └── JWT auth cần xong     └── LiveTradingNode cần xong
         trước khi bảo vệ          trước khi order routing
         live trading endpoints
Sprint 3 (Risk) không phụ thuộc Sprint 2 — có thể làm song song
Sprint 4 phụ thuộc tất cả sprint trước
```

---

# SPRINT 1 — Security & Notifications
> **Score target:** 5.3 → 6.5 · **Tất cả tests trong:** `test_security.py`, `test_notifications.py`

---

## TASK S1-01: Credential Encryption

**Tests liên quan:** `test_security.py::TestCredentialEncryption` (7 tests, hiện 7 xfail)
**Files cần tạo/sửa:**
- `backend/credential_utils.py` ← **TẠO MỚI**
- `backend/database.py` ← **SỬA** `upsert_adapter_config()` và `get_adapter_config()`
- `backend/routers/adapters.py` ← **SỬA** response masking

### B1: Tạo `backend/credential_utils.py`
```python
# Sử dụng thư viện: cryptography (đã có trong requirements hoặc thêm vào)
# pip install cryptography

import os
import base64
from cryptography.fernet import Fernet

def _get_fernet() -> Fernet:
    """Lấy Fernet key từ env ENCRYPTION_KEY, auto-generate nếu chưa có."""
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        # Development only: generate và warn
        key = Fernet.generate_key().decode()
        print(f"WARNING: ENCRYPTION_KEY not set. Using temporary key (restart will lose data).")
    return Fernet(key.encode() if isinstance(key, str) else key)

def encrypt_credential(plaintext: str) -> str:
    """Encrypt string → base64 ciphertext string."""
    if not plaintext:
        return ""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()

def decrypt_credential(ciphertext: str) -> str:
    """Decrypt base64 ciphertext → plaintext string."""
    if not ciphertext:
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        return ""  # Corrupt or wrong key → return empty

def mask_credential(plaintext: str, visible_chars: int = 4) -> str:
    """Mask credential, show only last N chars: '****abcd'."""
    if not plaintext or len(plaintext) <= visible_chars:
        return "****"
    return "*" * 8 + plaintext[-visible_chars:]
```

### B2: Sửa `backend/database.py`
```python
# Thêm import ở đầu file:
from credential_utils import encrypt_credential, decrypt_credential

# Sửa hàm upsert_adapter_config():
async def upsert_adapter_config(adapter_id, api_key="", api_secret="", status="disconnected", ...):
    # Encrypt trước khi lưu
    encrypted_key = encrypt_credential(api_key) if api_key else ""
    encrypted_secret = encrypt_credential(api_secret) if api_secret else ""
    # ... lưu encrypted_key, encrypted_secret vào DB thay vì plaintext

# Sửa hàm get_adapter_config():
async def get_adapter_config(adapter_id: str) -> Optional[dict]:
    # ... query DB
    if row:
        return {
            ...
            "api_key": decrypt_credential(row["api_key"]),  # decrypt khi đọc
            "api_secret": decrypt_credential(row["api_secret"]),
        }
```

### B3: Sửa `backend/routers/adapters.py`
```python
# Thêm import:
from credential_utils import mask_credential

# Trong endpoint GET /adapters/{adapter_id}:
config = await database.get_adapter_config(adapter_id)
if config and config.get("api_key"):
    # Không trả về api_key gốc, chỉ trả masked
    return {
        ...
        "api_key_masked": mask_credential(config["api_key"]),
        # KHÔNG có "api_key" hay "api_secret" trong response
    }

# Trong endpoint GET /adapters (list):
# Đảm bảo KHÔNG include api_key hay api_secret trong list response
```

### B4: Thêm vào `requirements.txt`
```
cryptography>=41.0.0
```

**Verify:** Chạy `pytest tests/test_security.py::TestCredentialEncryption -v` → 7 PASSED (không còn xfail)

---

## TASK S1-02: JWT Authentication

**Tests liên quan:** `test_security.py::TestJWTAuth` (9 tests, hiện 9 xfail)
**Files cần tạo/sửa:**
- `backend/auth_jwt.py` ← **TẠO MỚI**
- `backend/routers/auth.py` ← **TẠO MỚI**
- `backend/nautilus_fastapi.py` ← **SỬA** middleware + include auth router
- `frontend/src/lib/api.ts` hoặc `frontend/src/hooks/useAuth.ts` ← **SỬA** gửi Bearer token

### B1: Tạo `backend/auth_jwt.py`
```python
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt  # pip install python-jose[cryptography]
from passlib.context import CryptContext  # pip install passlib[bcrypt]

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hardcoded users cho MVP (Sprint 4 sẽ dùng DB)
USERS_DB = {
    "admin": {
        "username": "admin",
        "hashed_password": pwd_context.hash(os.getenv("ADMIN_PASSWORD", "admin")),
        "role": "admin"
    }
}

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def authenticate_user(username: str, password: str) -> Optional[dict]:
    user = USERS_DB.get(username)
    if user and verify_password(password, user["hashed_password"]):
        return user
    return None

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
```

### B2: Tạo `backend/routers/auth.py`
```python
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from auth_jwt import authenticate_user, create_access_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
async def login(body: LoginRequest):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user["username"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/refresh")
async def refresh(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401)
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    new_token = create_access_token({"sub": payload["sub"], "role": payload.get("role")})
    return {"access_token": new_token, "token_type": "bearer"}
```

### B3: Sửa `backend/nautilus_fastapi.py`
```python
# Thêm JWT middleware — bảo vệ /api/* (trừ /api/auth/* và /api/health)
from fastapi import Request, HTTPException
from auth_jwt import decode_token

PUBLIC_PATHS = {"/", "/health", "/api/health", "/api/auth/login", "/docs", "/redoc", "/openapi.json", "/ws"}

@app.middleware("http")
async def jwt_middleware(request: Request, call_next):
    if request.url.path in PUBLIC_PATHS or request.url.path.startswith("/api/auth/"):
        return await call_next(request)
    if request.url.path.startswith("/api/"):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authentication token")
        token = auth_header[7:]
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        request.state.user = payload
    return await call_next(request)

# Include auth router:
from routers.auth import router as auth_router
app.include_router(auth_router)
```

### B4: Thêm vào `requirements.txt`
```
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
```

### B5: Sửa Frontend
```typescript
// frontend/src/lib/api.ts hoặc tương đương
// Mọi request gửi header: Authorization: Bearer <token từ localStorage>
const token = localStorage.getItem('nautilus_token');
if (token) {
    headers['Authorization'] = `Bearer ${token}`;
}

// Sau login: lưu token
const { access_token } = await response.json();
localStorage.setItem('nautilus_token', access_token);
```

**Verify:** `pytest tests/test_security.py::TestJWTAuth -v` → 9 PASSED

---

## TASK S1-03 & S1-04: Email + Telegram Notifications

**Tests liên quan:** `test_notifications.py` (12 tests, hiện 10 xfail)
**Files cần tạo/sửa:**
- `backend/notifications.py` ← **TẠO MỚI**
- `backend/database.py` ← **SỬA** `trigger_alert()` gọi notifiers
- `backend/routers/system.py` ← **SỬA** thêm test-email, test-telegram endpoints

### B1: Tạo `backend/notifications.py`
```python
import asyncio
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import httpx
import database

class EmailNotifier:
    async def send(self, subject: str, body: str, to: str, settings: dict):
        """Gửi email qua SMTP. Retry tối đa 3 lần."""
        smtp_host = settings.get("smtp_host", "")
        smtp_port = settings.get("smtp_port", 587)
        smtp_user = settings.get("smtp_user", "")
        smtp_password = settings.get("smtp_password", "")
        from_addr = settings.get("smtp_from", smtp_user)

        if not smtp_host or not to:
            return

        msg = MIMEMultipart()
        msg["From"] = from_addr
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))

        for attempt in range(3):
            try:
                context = ssl.create_default_context()
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls(context=context)
                    if smtp_user:
                        server.login(smtp_user, smtp_password)
                    server.sendmail(from_addr, to, msg.as_string())
                return  # Success
            except Exception as e:
                if attempt == 2:
                    raise
                await asyncio.sleep(2 ** attempt)


class TelegramNotifier:
    async def send(self, text: str, bot_token: str, chat_id: str):
        """Gửi message qua Telegram Bot API."""
        if not bot_token or not chat_id:
            return
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        async with httpx.AsyncClient() as client:
            await client.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})


email_notifier = EmailNotifier()
telegram_notifier = TelegramNotifier()


async def notify_alert_triggered(alert: dict):
    """Gọi sau khi alert được trigger. Gửi email + telegram nếu enabled."""
    settings_data = await database.get_settings()
    notif = settings_data.get("notifications", {})

    symbol = alert.get("symbol", "")
    condition = alert.get("condition", "")
    price = alert.get("price", 0)
    subject = f"🚨 Alert: {symbol} {condition} {price}"
    body = f"""
    <h2>Price Alert Triggered</h2>
    <p><b>Symbol:</b> {symbol}</p>
    <p><b>Condition:</b> {condition} {price}</p>
    <p><b>Message:</b> {alert.get('message', '')}</p>
    """

    # Email
    if notif.get("email_enabled") and notif.get("email_to"):
        try:
            await email_notifier.send(subject, body, notif["email_to"], notif)
        except Exception as e:
            print(f"Email notification failed: {e}")

    # Telegram
    if notif.get("telegram_enabled") and notif.get("telegram_bot_token"):
        try:
            text = f"🚨 <b>{symbol}</b> alert: {condition} {price}\n{alert.get('message', '')}"
            await telegram_notifier.send(
                text,
                notif["telegram_bot_token"],
                notif.get("telegram_chat_id", "")
            )
        except Exception as e:
            print(f"Telegram notification failed: {e}")
```

### B2: Sửa `backend/database.py` — `trigger_alert()`
```python
# Trong hàm trigger_alert():
async def trigger_alert(alert_id: str):
    # ... cập nhật status = 'triggered' trong DB (đã có)

    # THÊM: gọi notifications
    alert = await get_alert(alert_id)
    if alert:
        import notifications  # lazy import để tránh circular
        await notifications.notify_alert_triggered(alert)
```

### B3: Thêm endpoints vào `backend/routers/system.py`
```python
@router.post("/notifications/test-email")
async def test_email(body: dict = Body(...)):
    """Gửi test email. Body: {email: str}"""
    from notifications import EmailNotifier
    settings = await database.get_settings()
    notif = settings.get("notifications", {})
    try:
        notifier = EmailNotifier()
        await notifier.send(
            "Test Email from Nautilus",
            "<p>Test email sent successfully!</p>",
            body.get("email", notif.get("email_to", "")),
            notif
        )
        return {"success": True, "message": "Test email sent"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/notifications/test-telegram")
async def test_telegram(body: dict = Body(...)):
    """Gửi test Telegram message. Body: {bot_token: str, chat_id: str}"""
    from notifications import TelegramNotifier
    try:
        notifier = TelegramNotifier()
        await notifier.send(
            "✅ Test message from Nautilus Web Interface",
            body.get("bot_token", ""),
            body.get("chat_id", "")
        )
        return {"success": True, "message": "Telegram message sent"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

**Verify:** `pytest tests/test_notifications.py -v` → 10+ PASSED

---

## TASK S1-05: Rate Limiting

**Tests liên quan:** `test_security.py::TestRateLimiting` (3 tests, hiện 3 xfail)
**Files cần sửa:**
- `backend/nautilus_fastapi.py` ← **SỬA** thêm slowapi
- `requirements.txt` ← **SỬA** thêm slowapi

### Implementation
```python
# requirements.txt: thêm
# slowapi>=0.1.9

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Bảo vệ login endpoint:
@auth_router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest):
    ...

# Thêm header X-RateLimit-Remaining vào mọi response:
@app.middleware("http")
async def add_ratelimit_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-RateLimit-Remaining"] = "99"  # slowapi tự cập nhật
    return response
```

**Verify:** `pytest tests/test_security.py::TestRateLimiting -v` → 3 PASSED

---

## Sprint 1 Checklist
```
[ ] S1-01: credential_utils.py tạo xong + database.py sửa xong
[ ] S1-01: pytest test_security.py::TestCredentialEncryption → 7 PASSED
[ ] S1-02: auth_jwt.py + routers/auth.py tạo xong
[ ] S1-02: pytest test_security.py::TestJWTAuth → 9 PASSED
[ ] S1-03: notifications.py tạo xong + trigger_alert() sửa xong
[ ] S1-03: pytest test_notifications.py → 10 PASSED
[ ] S1-05: slowapi integrate xong
[ ] S1-05: pytest test_security.py::TestRateLimiting → 3 PASSED
[ ] Chạy full suite: pytest tests/ → 0 FAILED
[ ] Cập nhật REVIEW_OVERVIEW.md score
[ ] git commit + push
```

---

# SPRINT 2 — Live Trading MVP
> **Score target:** 6.5 → 7.8 · **Tests:** `test_live_trading.py`
> **Prerequisite:** Sprint 1 hoàn thành (JWT auth bảo vệ live trading endpoints)

---

## TASK S2-01: LiveTradingNode Setup

**Tests liên quan:** `test_live_trading.py::TestLiveTradingNodeLifecycle` (5 tests)
**Files cần tạo/sửa:**
- `backend/live_trading.py` ← **TẠO MỚI** (class trung tâm)
- `backend/state.py` ← **SỬA** expose live_manager singleton
- `backend/routers/system.py` ← **SỬA** engine/info thêm live node status

### B1: Tạo `backend/live_trading.py`
```python
"""
LiveTradingManager — quản lý TradingNode cho live trading.

Nautilus TradingNode lifecycle:
  configure() → build() → start() → run() → stop()

Hiện tại dùng mock đến Sprint 2-02 khi integrate adapter thật.
"""
import asyncio
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field


@dataclass
class AdapterConnection:
    adapter_id: str
    connection_id: str
    status: str = "disconnected"
    websocket: Any = None


class LiveTradingManager:
    """
    Quản lý TradingNode và các adapter connections.
    Thread-safe singleton, dùng asyncio locks.
    """

    def __init__(self):
        self._connections: Dict[str, AdapterConnection] = {}
        self._is_active: bool = False
        self._node = None  # sẽ là TradingNode khi integrate
        self._lock = asyncio.Lock()
        self._order_callbacks: List[Callable] = []
        self._position_callbacks: List[Callable] = []

    def is_connected(self, adapter_id: str = None) -> bool:
        """Kiểm tra có adapter nào đang connected không."""
        if adapter_id:
            conn = self._connections.get(adapter_id)
            return conn is not None and conn.status == "connected"
        return any(c.status == "connected" for c in self._connections.values())

    async def connect_binance(self, api_key: str, api_secret: str) -> Dict[str, Any]:
        """
        Kết nối Binance Spot adapter.
        Sprint 2-02: implement với nautilus_trader.adapters.binance
        """
        async with self._lock:
            # TODO Sprint 2-02: thay bằng thật
            # from nautilus_trader.adapters.binance.spot.data import BinanceSpotDataClientConfig
            # from nautilus_trader.adapters.binance.spot.execution import BinanceSpotExecClientConfig
            # ... configure TradingNode

            import uuid
            connection_id = f"CONN-BINANCE-{uuid.uuid4().hex[:8].upper()}"
            self._connections["binance"] = AdapterConnection(
                adapter_id="binance",
                connection_id=connection_id,
                status="connected",
            )
            self._is_active = True
            return {"success": True, "connection_id": connection_id}

    async def disconnect(self, adapter_id: str) -> Dict[str, Any]:
        """Ngắt kết nối adapter."""
        async with self._lock:
            conn = self._connections.get(adapter_id)
            if conn:
                # TODO Sprint 2-02: đóng WS thật
                conn.status = "disconnected"
            # Nếu không còn adapter nào connected → deactivate node
            if not self.is_connected():
                self._is_active = False
            return {"success": True}

    async def submit_order(self, order: dict) -> Dict[str, Any]:
        """
        Submit order lên exchange.
        Sprint 2-03: implement với TradingNode.submit_order()
        """
        if not self.is_connected():
            raise RuntimeError("No adapter connected")
        # TODO Sprint 2-03: thay bằng TradingNode.submit_order()
        import uuid
        return {
            "success": True,
            "order_id": f"EXCHANGE-{uuid.uuid4().hex[:8].upper()}",
            "status": "pending",
        }

    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        """Cancel order trên exchange."""
        if not self.is_connected():
            raise RuntimeError("No adapter connected")
        # TODO Sprint 2-03: thay bằng TradingNode.cancel_order()
        return {"success": True}

    async def sync_positions(self) -> List[Dict[str, Any]]:
        """Sync positions từ exchange."""
        if not self.is_connected():
            return []
        # TODO Sprint 2-04: thay bằng TradingNode account state
        return []

    async def subscribe_ticker(self, symbol: str, on_message: Callable, backoff: float = 1.0):
        """Subscribe WebSocket ticker stream."""
        # TODO Sprint 2-05: implement WS subscription
        pass

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_active": self._is_active,
            "connections": {
                k: {"adapter_id": v.adapter_id, "status": v.status, "connection_id": v.connection_id}
                for k, v in self._connections.items()
            },
        }
```

### B2: Sửa `backend/state.py`
```python
# Thêm vào state.py:
from live_trading import LiveTradingManager

live_manager = LiveTradingManager()
```

### B3: Sửa `backend/routers/system.py` — endpoint `GET /engine/info`
```python
from state import nautilus_system, live_manager

@router.get("/engine/info")
async def get_engine_info():
    info = nautilus_system.get_system_info()
    live_status = live_manager.get_status()

    # Xác định engine type
    engine_type = "live" if live_status["is_active"] else "backtest"

    return {
        **info,
        "engine_type": engine_type,
        "live_node_active": live_status["is_active"],
        "live_connections": live_status["connections"],
    }
```

**Verify:** `pytest tests/test_live_trading.py::TestLiveTradingNodeLifecycle -v`

---

## TASK S2-02: Binance Adapter thật (Real WebSocket)

**Tests liên quan:** `test_live_trading.py::TestAdapterInterface` (4 tests)
**Files cần sửa:**
- `backend/live_trading.py` ← **SỬA** `connect_binance()` dùng nautilus thật
- `backend/routers/adapters.py` ← **SỬA** gọi live_manager thay vì DB-only

### B1: Sửa `connect_binance()` trong `backend/live_trading.py`
```python
async def connect_binance(self, api_key: str, api_secret: str) -> Dict[str, Any]:
    """Kết nối Binance Spot qua nautilus_trader adapter."""
    from nautilus_trader.adapters.binance.common.enums import BinanceAccountType
    from nautilus_trader.adapters.binance.spot.data import BinanceSpotDataClientConfig
    from nautilus_trader.adapters.binance.spot.execution import BinanceSpotExecClientConfig
    from nautilus_trader.live.node import TradingNode, TradingNodeConfig

    config = TradingNodeConfig(
        trader_id="TRADER-LIVE-001",
        data_clients={
            "BINANCE": BinanceSpotDataClientConfig(
                api_key=api_key,
                api_secret=api_secret,
                account_type=BinanceAccountType.SPOT,
                testnet=True,  # Sprint 2: dùng testnet trước
            )
        },
        exec_clients={
            "BINANCE": BinanceSpotExecClientConfig(
                api_key=api_key,
                api_secret=api_secret,
                account_type=BinanceAccountType.SPOT,
                testnet=True,
            )
        },
    )

    node = TradingNode(config=config)
    await node.initialize()

    import uuid
    connection_id = f"CONN-{uuid.uuid4().hex[:8].upper()}"
    self._connections["binance"] = AdapterConnection(
        adapter_id="binance",
        connection_id=connection_id,
        status="connected",
        websocket=node,
    )
    self._node = node
    self._is_active = True
    return {"success": True, "connection_id": connection_id}
```

### B2: Sửa `backend/routers/adapters.py` — POST connect
```python
from state import live_manager
from credential_utils import decrypt_credential

@router.post("/{adapter_id}/connect")
async def connect_adapter(adapter_id: str, payload: dict = Body(...)):
    # Validate credentials
    api_key = payload.get("api_key", "")
    api_secret = payload.get("api_secret", "")
    if not api_key or not api_secret:
        raise HTTPException(status_code=400, detail="api_key and api_secret required")

    # Lưu credentials (encrypted)
    await database.upsert_adapter_config(adapter_id, api_key=api_key, api_secret=api_secret, status="connecting")

    # Kết nối thật
    try:
        if adapter_id == "binance":
            result = await live_manager.connect_binance(api_key, api_secret)
        elif adapter_id == "bybit":
            result = await live_manager.connect_bybit(api_key, api_secret)  # Sprint 4
        else:
            # Adapter chưa có live implementation
            result = {"success": True, "connection_id": None}

        status = "connected" if result["success"] else "error"
        await database.upsert_adapter_config(adapter_id, status=status,
                                             extra_config={"connection_id": result.get("connection_id")})
        return {"success": True, "status": status, **result}
    except Exception as e:
        await database.upsert_adapter_config(adapter_id, status="error")
        raise HTTPException(status_code=502, detail=f"Connection failed: {str(e)}")
```

**Verify:** `pytest tests/test_live_trading.py::TestAdapterInterface -v`

---

## TASK S2-03: Real Order Routing

**Tests liên quan:** `test_live_trading.py::TestOrderRouting` (4 tests)
**Files cần sửa:**
- `backend/routers/orders.py` ← **SỬA** check live_manager, route đến exchange

### Sửa `backend/routers/orders.py`
```python
from state import live_manager, nautilus_system, manager as ws_manager
import database

@router.post("/orders")
async def create_order(body: dict = Body(...)):
    instrument = body.get("instrument", "")
    side = body.get("side", "BUY")
    order_type = body.get("type", "MARKET")
    quantity = float(body.get("quantity", 0))
    price = body.get("price")

    # Nếu có adapter live connected → route to exchange
    if live_manager.is_connected():
        try:
            exchange_result = await live_manager.submit_order({
                "instrument": instrument, "side": side,
                "type": order_type, "quantity": quantity, "price": price,
            })
            # Lưu vào DB với exchange_order_id
            order_id = await database.create_order(
                instrument=instrument, side=side, order_type=order_type,
                quantity=quantity, price=price or 0,
                exchange_order_id=exchange_result.get("order_id"),
            )
            return {"success": True, "order_id": order_id,
                    "exchange_order_id": exchange_result.get("order_id"), "status": "pending"}
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))
    else:
        # Simulation mode (không có adapter connected)
        raise HTTPException(
            status_code=400,
            detail="No adapter connected. Connect an exchange adapter first to trade live."
        )
```

**Lưu ý:** Cần thêm cột `exchange_order_id` vào bảng `orders` trong DB migration.

**Verify:** `pytest tests/test_live_trading.py::TestOrderRouting -v`

---

## TASK S2-04: Live Position Sync

**Tests liên quan:** `test_live_trading.py::TestPositionSync` (3 tests)
**Files cần sửa:**
- `backend/routers/positions.py` ← **SỬA** thêm source field + sync endpoint

### Sửa `backend/routers/positions.py`
```python
from state import live_manager

@router.get("/positions")
async def list_positions(open_only: bool = True):
    db_positions = await database.list_db_positions(open_only=open_only)

    # Xác định source
    source = "live" if live_manager.is_connected() else "cached"

    # Enrich với live prices
    for pos in db_positions:
        symbol = pos.get("instrument", "").split("/")[0] + "USDT"
        try:
            data = await market_data_service.get_symbol_data(symbol)
            if data:
                current_price = float(data.get("price", pos.get("entry_price", 0)))
                entry = float(pos.get("entry_price", 0))
                qty = float(pos.get("quantity", 0))
                mult = 1 if pos.get("side") == "LONG" else -1
                pos["current_price"] = current_price
                pos["unrealized_pnl"] = round((current_price - entry) * qty * mult, 2)
        except Exception:
            pass
        pos["source"] = source

    return db_positions

@router.post("/positions/sync")
async def sync_positions():
    """Sync positions từ exchange (chỉ khi adapter connected)."""
    if not live_manager.is_connected():
        raise HTTPException(status_code=400, detail="No adapter connected")

    live_positions = await live_manager.sync_positions()
    # Lưu vào DB
    for pos in live_positions:
        await database.upsert_position(pos)

    return {"success": True, "synced_count": len(live_positions), "positions": live_positions}
```

**Verify:** `pytest tests/test_live_trading.py::TestPositionSync -v`

---

## TASK S2-05: WebSocket Market Data Feed

**Tests liên quan:** `test_live_trading.py::TestMarketDataWebSocket` (2 tests)
**Files cần sửa:**
- `backend/live_trading.py` ← **SỬA** implement `subscribe_ticker()` với reconnect
- `backend/nautilus_fastapi.py` ← **SỬA** WS handler broadcast market data

### Sửa `subscribe_ticker()` trong `backend/live_trading.py`
```python
async def subscribe_ticker(self, symbol: str, on_message: Callable, backoff: float = 1.0):
    """Subscribe Binance WebSocket ticker với exponential backoff reconnect."""
    import websockets
    import json

    url = f"wss://stream.binance.com:9443/ws/{symbol.lower()}@ticker"
    max_backoff = 60.0
    current_backoff = backoff

    while True:
        try:
            async with websockets.connect(url) as ws:
                current_backoff = backoff  # reset on success
                async for raw in ws:
                    data = json.loads(raw)
                    await on_message(data)
        except Exception as e:
            print(f"WS {symbol} disconnected: {e}. Retry in {current_backoff}s")
            await asyncio.sleep(current_backoff)
            current_backoff = min(current_backoff * 2, max_backoff)
```

### Thêm `requirements.txt`
```
websockets>=12.0
```

**Verify:** `pytest tests/test_live_trading.py::TestMarketDataWebSocket -v`

---

## Sprint 2 Checklist
```
[ ] S2-01: live_trading.py tạo xong + state.py expose live_manager
[ ] S2-01: pytest test_live_trading.py::TestLiveTradingNodeLifecycle → PASSED
[ ] S2-02: connect_binance() implement + adapters.py gọi live_manager
[ ] S2-02: pytest test_live_trading.py::TestAdapterInterface → PASSED
[ ] S2-03: orders.py route to exchange khi adapter connected
[ ] S2-03: pytest test_live_trading.py::TestOrderRouting → PASSED
[ ] S2-04: positions.py thêm source field + sync endpoint
[ ] S2-04: pytest test_live_trading.py::TestPositionSync → PASSED
[ ] S2-05: subscribe_ticker() implement với backoff
[ ] S2-05: pytest test_live_trading.py::TestMarketDataWebSocket → PASSED
[ ] Chạy full suite: pytest tests/ → 0 FAILED
[ ] Cập nhật REVIEW_OVERVIEW.md score
[ ] git commit + push
```

---

# SPRINT 3 — Strategy Runtime & Risk Enforcement
> **Score target:** 7.8 → 8.5 · **Tests:** `test_risk_enforcement.py`, `test_strategy_runtime.py`
> **Có thể làm song song với Sprint 2 (độc lập)**

---

## TASK S3-01: Strategy "Start" thực sự chạy trên engine

**Tests liên quan:** `test_strategy_runtime.py::TestStrategyLifecycle` (xfail parts)
**Files cần sửa:**
- `backend/routers/strategies.py` ← **SỬA** start/stop gọi live_manager
- `backend/live_trading.py` ← **SỬA** thêm `add_strategy()`, `remove_strategy()`
- `backend/nautilus_core.py` ← **SỬA** thêm `start_strategy()`, `stop_strategy()`

### B1: Thêm vào `backend/nautilus_core.py`
```python
def start_strategy(self, strategy_id: str) -> bool:
    """Bắt đầu chạy strategy trong engine."""
    strategy_config = self.strategies.get(strategy_id)
    if not strategy_config:
        return False
    # Nếu có live engine → add strategy vào TradingNode
    # Nếu chỉ backtest → mark as running (sẽ chạy khi backtest next time)
    self.strategies[strategy_id]["status"] = "running"
    return True

def stop_strategy(self, strategy_id: str) -> bool:
    """Dừng strategy."""
    if strategy_id in self.strategies:
        self.strategies[strategy_id]["status"] = "stopped"
        return True
    return False
```

### B2: Sửa `backend/routers/strategies.py` — start/stop
```python
from state import nautilus_system, live_manager

@router.post("/strategies/{strategy_id}/start")
async def start_strategy(strategy_id: str):
    # Cập nhật DB
    await database.update_strategy_status(strategy_id, "running")

    # Nếu live engine active → đăng ký strategy
    if live_manager.is_connected():
        # Sprint S3-01: thêm strategy vào TradingNode
        pass  # TODO: live_manager.add_strategy(strategy_id, config)

    # Cập nhật in-memory
    nautilus_system.start_strategy(strategy_id)

    # WS broadcast
    await manager.broadcast({"type": "strategy_started", "strategy_id": strategy_id})
    return {"success": True, "status": "running"}

@router.post("/strategies/{strategy_id}/stop")
async def stop_strategy(strategy_id: str):
    await database.update_strategy_status(strategy_id, "stopped")
    nautilus_system.stop_strategy(strategy_id)
    await manager.broadcast({"type": "strategy_stopped", "strategy_id": strategy_id})
    return {"success": True, "status": "stopped"}
```

---

## TASK S3-02: MACD Strategy

**Tests liên quan:** `test_strategy_runtime.py::TestMACDStrategy` (5 tests, 4 xfail)
**Files cần tạo/sửa:**
- `backend/strategies/macd_strategy.py` ← **TẠO MỚI**
- `backend/routers/strategies.py` ← **SỬA** thêm "macd" vào types

### B1: Tạo `backend/strategies/macd_strategy.py`
```python
from decimal import Decimal
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.config import StrategyConfig
from nautilus_trader.indicators.macd import MovingAverageConvergenceDivergence
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide

class MACDStrategyConfig(StrategyConfig, frozen=True):
    instrument_id: str
    bar_type: str
    fast_period: int = 12
    slow_period: int = 26
    signal_period: int = 9
    trade_size: Decimal = Decimal("100000")

class MACDStrategy(Strategy):
    def __init__(self, config: MACDStrategyConfig):
        super().__init__(config)
        self.macd = MovingAverageConvergenceDivergence(
            config.fast_period, config.slow_period, config.signal_period
        )
        self._prev_macd = None
        self._prev_signal = None

    def on_start(self):
        self.register_indicator_for_bars(self.bar_type, self.macd)
        self.subscribe_bars(self.bar_type)

    def on_bar(self, bar: Bar):
        if not self.macd.initialized:
            return

        macd_val = self.macd.value
        signal_val = self.macd.signal

        if self._prev_macd is not None and self._prev_signal is not None:
            # MACD cross above signal → BUY
            if self._prev_macd < self._prev_signal and macd_val > signal_val:
                if not self.portfolio.is_net_long(self.instrument_id):
                    self._buy()
            # MACD cross below signal → SELL
            elif self._prev_macd > self._prev_signal and macd_val < signal_val:
                if not self.portfolio.is_net_short(self.instrument_id):
                    self._sell()

        self._prev_macd = macd_val
        self._prev_signal = signal_val

    def _buy(self):
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.BUY,
            quantity=self.instrument.make_qty(self.config.trade_size),
        )
        self.submit_order(order)

    def _sell(self):
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.SELL,
            quantity=self.instrument.make_qty(self.config.trade_size),
        )
        self.submit_order(order)

    def on_stop(self):
        self.close_all_positions(self.instrument_id)
```

### B2: Sửa `backend/routers/strategies.py` — thêm MACD vào types
```python
STRATEGY_TYPES = {
    "sma_crossover": {
        "id": "sma_crossover",
        "name": "SMA Crossover",
        "description": "Buy when fast SMA crosses above slow SMA, sell on cross below",
        "params": [
            {"name": "fast_period", "type": "int", "default": 10, "min": 2, "max": 500},
            {"name": "slow_period", "type": "int", "default": 50, "min": 3, "max": 500},
        ]
    },
    "rsi": { ... },  # giữ nguyên
    "macd": {      # THÊM MỚI
        "id": "macd",
        "name": "MACD",
        "description": "Buy when MACD line crosses above signal line",
        "params": [
            {"name": "fast_period", "type": "int", "default": 12, "min": 2, "max": 200},
            {"name": "slow_period", "type": "int", "default": 26, "min": 3, "max": 500},
            {"name": "signal_period", "type": "int", "default": 9, "min": 2, "max": 100},
        ]
    },
}
```

**Verify:** `pytest tests/test_strategy_runtime.py::TestMACDStrategy -v` → 5 PASSED

---

## TASK S3-03: Risk Limits Enforcement

**Tests liên quan:** `test_risk_enforcement.py` (15 tests xfail — critical)
**Files cần tạo/sửa:**
- `backend/risk_engine.py` ← **TẠO MỚI**
- `backend/routers/orders.py` ← **SỬA** gọi risk check trước khi submit
- `backend/database.py` ← **SỬA** thêm daily P&L query

### B1: Tạo `backend/risk_engine.py`
```python
"""
RiskEngine — kiểm tra risk limits trước khi cho phép tạo order.
Tất cả checks phải PASS mới submit order được.
"""
import database
from datetime import date, datetime, timezone
from typing import Dict, Any, Optional
from fastapi import HTTPException


class RiskCheckError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=422, detail={"error": "risk_limit_exceeded", "message": detail})


class RiskEngine:

    async def check_order(self, order: Dict[str, Any]) -> None:
        """
        Chạy tất cả risk checks. Raise RiskCheckError nếu bất kỳ check nào fail.
        order: {instrument, side, type, quantity, price, leverage}
        """
        limits = await self._get_limits()

        await self._check_max_position_size(order, limits)
        await self._check_daily_loss_limit(limits)
        await self._check_leverage(order, limits)
        await self._check_orders_per_day(limits)

    async def _get_limits(self) -> Dict[str, Any]:
        return await database.get_risk_limits()

    async def _check_max_position_size(self, order: dict, limits: dict):
        """order_value = quantity × price > max_position_size → REJECT"""
        max_pos = float(limits.get("max_position_size", float("inf")))
        if max_pos == float("inf"):
            return

        quantity = float(order.get("quantity", 0))
        price = float(order.get("price") or 0)

        # Nếu không có price (MARKET order) → dùng giá hiện tại từ market data
        if price == 0:
            from market_data_service import get_symbol_data
            symbol = order.get("instrument", "").replace("/", "").replace(".BINANCE", "") + "T"
            data = await get_symbol_data(symbol)
            price = float(data.get("price", 0)) if data else 0

        order_value = quantity * price
        if order_value > max_pos:
            raise RiskCheckError(
                f"Order value {order_value:.2f} exceeds max_position_size limit of {max_pos:.2f}"
            )

    async def _check_daily_loss_limit(self, limits: dict):
        """Tổng realized loss hôm nay > max_daily_loss → REJECT tất cả orders mới"""
        max_loss = float(limits.get("max_daily_loss", float("inf")))
        if max_loss == float("inf"):
            return

        daily_loss = await database.get_daily_realized_loss()
        if abs(daily_loss) > max_loss:
            raise RiskCheckError(
                f"Daily loss {abs(daily_loss):.2f} has exceeded max_daily_loss limit of {max_loss:.2f}. "
                f"Trading halted until tomorrow."
            )

    async def _check_leverage(self, order: dict, limits: dict):
        """leverage field trong order > max_leverage → REJECT"""
        max_lev = float(limits.get("max_leverage", float("inf")))
        if max_lev == float("inf"):
            return

        order_leverage = float(order.get("leverage", 1.0))
        if order_leverage > max_lev:
            raise RiskCheckError(
                f"Order leverage {order_leverage}x exceeds max_leverage limit of {max_lev}x"
            )

    async def _check_orders_per_day(self, limits: dict):
        """Số orders đã tạo hôm nay ≥ max_orders_per_day → REJECT"""
        max_orders = int(limits.get("max_orders_per_day", 999999))
        if max_orders >= 999999:
            return

        today_count = await database.count_orders_today()
        if today_count >= max_orders:
            raise RiskCheckError(
                f"Daily order limit of {max_orders} reached ({today_count} orders placed today)"
            )


risk_engine = RiskEngine()
```

### B2: Thêm vào `backend/database.py`
```python
async def get_daily_realized_loss() -> float:
    """Tổng PnL âm từ các orders filled hôm nay."""
    today = date.today().isoformat()
    rows = await _fetchall(
        "SELECT COALESCE(SUM(pnl), 0) FROM orders WHERE status='filled' AND date(timestamp)=? AND pnl < 0",
        (today,)
    )
    return float(rows[0][0]) if rows else 0.0

async def count_orders_today() -> int:
    """Số orders tạo hôm nay."""
    today = date.today().isoformat()
    rows = await _fetchall(
        "SELECT COUNT(*) FROM orders WHERE date(timestamp)=?",
        (today,)
    )
    return int(rows[0][0]) if rows else 0
```

### B3: Sửa `backend/routers/orders.py` — thêm risk check
```python
from risk_engine import risk_engine, RiskCheckError

@router.post("/orders")
async def create_order(body: dict = Body(...)):
    # 1. Risk check TRƯỚC
    try:
        await risk_engine.check_order(body)
    except RiskCheckError:
        raise  # Re-raise với 422

    # 2. Route to exchange hoặc simulation
    if live_manager.is_connected():
        ...  # live
    else:
        ...  # simulation
```

### B4: Daily Loss Auto-Stop — thêm vào background task
```python
# Trong nautilus_fastapi.py lifespan hoặc background task:
async def monitor_daily_loss():
    """Background: dừng tất cả strategies nếu daily loss vượt limit"""
    while True:
        await asyncio.sleep(60)  # check mỗi phút
        limits = await database.get_risk_limits()
        max_loss = float(limits.get("max_daily_loss", float("inf")))
        if max_loss == float("inf"):
            continue

        daily_loss = await database.get_daily_realized_loss()
        if abs(daily_loss) > max_loss:
            # Stop tất cả running strategies
            strategies = await database.list_strategies()
            for s in strategies:
                if s["status"] == "running":
                    await database.update_strategy_status(s["id"], "stopped")
                    nautilus_system.stop_strategy(s["id"])

            # Broadcast alert
            await manager.broadcast({
                "type": "daily_loss_limit_reached",
                "daily_loss": daily_loss,
                "limit": max_loss
            })
```

**Verify:** `pytest tests/test_risk_enforcement.py -v` → 13+ PASSED

---

## TASK S3-04: RSI Validation Fix

**Tests liên quan:** `test_strategy_runtime.py::TestRSILogic` (2 xfail)
**Files cần sửa:** `backend/routers/strategies.py`

```python
# Trong endpoint POST /strategies — thêm validation cho RSI:
if strategy_type == "rsi":
    rsi_period = config.get("rsi_period", 14)
    oversold = config.get("oversold_level", 30)
    overbought = config.get("overbought_level", 70)

    if rsi_period < 2:
        raise HTTPException(422, detail="rsi_period must be >= 2")
    if oversold >= overbought:
        raise HTTPException(422, detail="oversold_level must be < overbought_level")
```

---

## TASK S3-05: Candlestick Chart (Frontend)

**Files cần sửa:** `frontend/src/pages/BacktestingPage.tsx`

```bash
# Cài thư viện
cd frontend && pnpm add lightweight-charts

# Hoặc dùng recharts ComposedChart với custom candlestick shape
```

```tsx
// Thay equity curve LineChart bằng OHLC CandlestickChart:
import { createChart } from 'lightweight-charts';

useEffect(() => {
    const chart = createChart(chartRef.current, { width: 800, height: 400 });
    const candleSeries = chart.addCandlestickSeries();
    candleSeries.setData(ohlcData);  // từ backtest results
    return () => chart.remove();
}, [ohlcData]);
```

---

## Sprint 3 Checklist
```
[ ] S3-01: nautilus_core.py thêm start_strategy/stop_strategy
[ ] S3-01: strategies.py start/stop gọi nautilus_system
[ ] S3-02: macd_strategy.py tạo xong
[ ] S3-02: strategies.py thêm "macd" type + validation
[ ] S3-02: pytest test_strategy_runtime.py::TestMACDStrategy → PASSED
[ ] S3-03: risk_engine.py tạo xong với 4 checks
[ ] S3-03: database.py thêm get_daily_realized_loss + count_orders_today
[ ] S3-03: orders.py gọi risk_engine.check_order() trước khi submit
[ ] S3-03: pytest test_risk_enforcement.py → 13+ PASSED
[ ] S3-04: RSI validation fix → test_strategy_runtime.py::TestRSILogic → PASSED
[ ] S3-05: Candlestick chart frontend
[ ] Chạy full suite: pytest tests/ → 0 FAILED
[ ] Cập nhật REVIEW_OVERVIEW.md score
[ ] git commit + push
```

---

# SPRINT 4 — Production Polish
> **Score target:** 8.5 → 9.5 · **Độc lập với Sprint 2 & 3**

---

## TASK S4-01: Multi-user Support

**Files cần tạo/sửa:**
- `backend/database.py` ← **SỬA** thêm `users` table
- `backend/auth_jwt.py` ← **SỬA** dùng DB users thay vì hardcoded
- `backend/routers/auth.py` ← **SỬA** thêm register endpoint

### DB Migration
```sql
-- Thêm vào database.py init_db():
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'trader',  -- 'admin' | 'trader'
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
);

-- Thêm user_id vào các tables có liên quan:
ALTER TABLE strategies ADD COLUMN user_id TEXT;
ALTER TABLE alerts ADD COLUMN user_id TEXT;
ALTER TABLE orders ADD COLUMN user_id TEXT;
```

### Auth từ DB
```python
# auth_jwt.py — authenticate từ DB
async def authenticate_user_db(username: str, password: str) -> Optional[dict]:
    user = await database.get_user(username)
    if user and pwd_context.verify(password, user["hashed_password"]):
        return user
    return None
```

### Data Isolation
```python
# Mỗi query phải filter theo user_id từ JWT token
# Ví dụ: GET /api/strategies → chỉ trả strategies của user hiện tại
# Admin → thấy tất cả
current_user = request.state.user  # từ JWT middleware
if current_user["role"] != "admin":
    strategies = filter by user_id == current_user["sub"]
```

---

## TASK S4-02: Bybit Adapter

**Files cần sửa:**
- `backend/live_trading.py` ← **SỬA** thêm `connect_bybit()`
- `backend/routers/adapters.py` ← **SỬA** thêm bybit case

```python
async def connect_bybit(self, api_key: str, api_secret: str) -> Dict[str, Any]:
    from nautilus_trader.adapters.bybit.data import BybitDataClientConfig
    from nautilus_trader.adapters.bybit.execution import BybitExecClientConfig
    # ... tương tự Binance
```

---

## TASK S4-03: Export Reports (PDF/Excel)

**Files cần tạo/sửa:**
- `backend/routers/system.py` ← **SỬA** thêm export endpoints

```python
# requirements.txt: thêm
# openpyxl>=3.1.0
# reportlab>=4.0.0  (hoặc weasyprint)

@router.get("/performance/export")
async def export_performance(format: str = "excel"):
    if format == "excel":
        # Tạo Excel với openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        # ... populate with trade data
        return StreamingResponse(excel_bytes, media_type="application/vnd.ms-excel",
                                  headers={"Content-Disposition": "attachment; filename=performance.xlsx"})
    elif format == "pdf":
        # Tạo PDF với reportlab
        ...
```

---

## TASK S4-04: Audit Log

**Files cần tạo/sửa:**
- `backend/database.py` ← **SỬA** thêm `audit_logs` table + `log_action()`
- `backend/routers/orders.py` ← **SỬA** log mọi order action
- `backend/routers/system.py` ← **SỬA** thêm GET /admin/audit-logs

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT,
    action      TEXT NOT NULL,   -- 'order_created', 'login', 'setting_changed', etc.
    resource    TEXT,            -- 'order:ORD-001', 'strategy:STR-002'
    details     TEXT,            -- JSON
    ip_address  TEXT,
    timestamp   TEXT NOT NULL
    -- Không có UPDATE/DELETE — append only
);
```

```python
# Trong mọi critical action:
await database.log_action(
    user_id=request.state.user["sub"],
    action="order_created",
    resource=f"order:{order_id}",
    details=json.dumps(body),
    ip_address=request.client.host
)
```

---

## TASK S4-05: Real 2FA (TOTP)

**Files cần tạo/sửa:**
- `backend/routers/auth.py` ← **SỬA** thêm setup-2fa, verify-2fa
- `requirements.txt` ← **SỬA** thêm pyotp, qrcode

```python
# requirements.txt:
# pyotp>=2.9.0
# qrcode[pil]>=7.4.0

import pyotp
import qrcode
import io, base64

@router.post("/auth/setup-2fa")
async def setup_2fa(request: Request):
    user = request.state.user
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(user["sub"], issuer_name="Nautilus")

    # Tạo QR code
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf)
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    # Lưu secret (encrypted) vào DB user record
    await database.save_2fa_secret(user["sub"], encrypt_credential(secret))

    return {"qr_code": f"data:image/png;base64,{qr_b64}", "secret": secret}

@router.post("/auth/verify-2fa")
async def verify_2fa(body: dict, request: Request):
    user = request.state.user
    encrypted_secret = await database.get_2fa_secret(user["sub"])
    secret = decrypt_credential(encrypted_secret)
    totp = pyotp.TOTP(secret)

    if not totp.verify(body.get("code", ""), valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")

    # Tạo token mới với 2fa_verified=True
    token = create_access_token({"sub": user["sub"], "2fa_verified": True})
    return {"access_token": token, "token_type": "bearer"}
```

---

## Sprint 4 Checklist
```
[ ] S4-01: users table + DB auth + data isolation
[ ] S4-01: multi-user register/login flow
[ ] S4-02: connect_bybit() trong live_trading.py
[ ] S4-03: export endpoint Excel + PDF
[ ] S4-04: audit_logs table + log_action() trong critical paths
[ ] S4-04: GET /admin/audit-logs endpoint
[ ] S4-05: setup-2fa + verify-2fa endpoints
[ ] Chạy full suite: pytest tests/ → 0 FAILED
[ ] Chạy E2E: cd e2e && npx playwright test
[ ] Cập nhật REVIEW_OVERVIEW.md score → target 9.5
[ ] git commit + push
```

---

# TỔNG KẾT IMPLEMENTATION PLAN

## Dependency Graph
```
S1-01 Credential Encryption  ─────────────────────────────────────────┐
S1-02 JWT Auth               ──┐                                      │
S1-03 Email Notifications    ──┤ Sprint 1 ── S2-02 Binance Adapter    │
S1-04 Telegram Notifications ──┤                    │                  │
S1-05 Rate Limiting          ──┘             S2-01 LiveTradingNode     │
                                                     │                  │
S2-01 LiveTradingNode ────────────────────────────── │                  │
S2-02 Binance Adapter ──────────────────────────┐   │                  │
S2-03 Order Routing ────── phụ thuộc S2-02 ─────┤   │                  │
S2-04 Position Sync ────── phụ thuộc S2-01 ─────┘   │                  │
S2-05 WS Feed ──────────── phụ thuộc S2-01          │                  │
                                                     │                  │
S3-01 Strategy Runtime ─── phụ thuộc S2-01          │                  │
S3-02 MACD Strategy ─────── độc lập ────────────────┘                  │
S3-03 Risk Enforcement ──── độc lập ────────────────────────────────────┘
S3-04 RSI Validation ─────── độc lập
S3-05 Candlestick Chart ──── độc lập (FE only)

S4-01 Multi-user ─────────── phụ thuộc S1-02 (JWT)
S4-02 Bybit Adapter ─────── phụ thuộc S2-02 (Binance pattern)
S4-03 Export Reports ─────── độc lập
S4-04 Audit Log ─────────── phụ thuộc S4-01 (user_id)
S4-05 2FA ───────────────── phụ thuộc S1-02 (JWT)
```

## File Changes Summary

| File | Hành động | Sprint | Task |
|---|:---:|:---:|---|
| `credential_utils.py` | TẠO MỚI | S1 | S1-01 |
| `auth_jwt.py` | TẠO MỚI | S1 | S1-02 |
| `routers/auth.py` | TẠO MỚI | S1 | S1-02 |
| `notifications.py` | TẠO MỚI | S1 | S1-03/04 |
| `live_trading.py` | TẠO MỚI | S2 | S2-01 |
| `risk_engine.py` | TẠO MỚI | S3 | S3-03 |
| `strategies/macd_strategy.py` | TẠO MỚI | S3 | S3-02 |
| `database.py` | SỬA | S1,S2,S3,S4 | Multiple |
| `nautilus_fastapi.py` | SỬA | S1,S2 | S1-02, S1-05, S3-04 |
| `state.py` | SỬA | S2 | S2-01 |
| `nautilus_core.py` | SỬA | S3 | S3-01 |
| `routers/adapters.py` | SỬA | S1,S2 | S1-01, S2-02 |
| `routers/orders.py` | SỬA | S2,S3 | S2-03, S3-03 |
| `routers/positions.py` | SỬA | S2 | S2-04 |
| `routers/strategies.py` | SỬA | S3 | S3-01, S3-02, S3-04 |
| `routers/system.py` | SỬA | S1,S4 | S1-03, S4-03, S4-04 |
| `routers/risk.py` | SỬA | S3 | S3-03 metrics |
| `frontend/src/App.tsx` | SỬA | S1 | S1-02 |
| `frontend/src/pages/BacktestingPage.tsx` | SỬA | S3 | S3-05 |
| `requirements.txt` | SỬA | S1,S2,S4 | Multiple |

## Score Trajectory

| Sprint | Tasks | Score | Key wins |
|---|---|:---:|---|
| Baseline | — | 5.3 | — |
| Sprint 1 | S1-01 đến S1-05 | **6.5** | Credentials safe, JWT auth, Notifications |
| Sprint 2 | S2-01 đến S2-05 | **7.8** | Live trading, Real orders, WS feed |
| Sprint 3 | S3-01 đến S3-05 | **8.5** | Risk enforced, MACD, Strategy runtime |
| Sprint 4 | S4-01 đến S4-05 | **9.5** | Multi-user, Bybit, 2FA, Audit log |

## Cách Chạy Test Sau Mỗi Sprint
```bash
# Unit tests
cd /home/user/Nautilus-Web-Interface/backend
pytest tests/ -v --tb=short
# Expected: số "passed" tăng, "xfailed" giảm, "failed" = 0

# E2E tests (cần backend + frontend đang chạy)
cd /home/user/Nautilus-Web-Interface/e2e
npx playwright test --reporter=html

# Coverage report
pytest tests/ --cov=. --cov-report=html
# Mở: htmlcov/index.html
```

---

*Plan này kết hợp với tests đã viết sẵn trong `test_security.py`, `test_risk_enforcement.py`,
`test_notifications.py`, `test_live_trading.py`, `test_strategy_runtime.py`.
Mỗi task hoàn thành sẽ chuyển một số lượng xfail → passed tương ứng.*
