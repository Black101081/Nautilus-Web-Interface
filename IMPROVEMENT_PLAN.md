# Improvement Plan — Nautilus Web Interface

> **Baseline score:** 5.3/10 (2026-03-15)
> **Target score:** 9.2/10 (sau Sprint 4)
> **Branch:** `claude/review-project-Kvyx9`

---

## Nguyên tắc

1. **Test-first:** Mỗi feature phải có test trước khi implement.
2. **Review sau mỗi sprint:** Cập nhật `REVIEW_OVERVIEW.md` → score phải tăng.
3. **Không merge nếu tests fail:** CI phải xanh 100%.
4. **Security trước tiên:** Sprint 1 bắt buộc, không skip.

---

## SPRINT 1 — Security & Notifications
> **Mục tiêu score:** 5.3 → 6.5 · **Ưu tiên:** 🔴 Critical

### S1-01: Mã hóa credentials adapter (Fernet)
**Vấn đề hiện tại:** API key/secret lưu plaintext trong SQLite — bất kỳ ai đọc DB là lấy được.

**Acceptance criteria:**
- [ ] Credentials được mã hóa bằng `cryptography.fernet.Fernet` trước khi lưu DB
- [ ] Key mã hóa lấy từ env var `ENCRYPTION_KEY` (base64 32-byte)
- [ ] GET `/api/adapters/{id}` trả về `api_key_masked: "****1234"` (4 char cuối)
- [ ] Không bao giờ trả về ciphertext hay plaintext qua API
- [ ] Test: lưu credentials → đọc DB trực tiếp → không thấy plaintext
- [ ] Test: lưu credentials → GET adapter → thấy masked

**Files cần sửa:**
- `backend/database.py` — `upsert_adapter_config()`, `get_adapter_config()`
- `backend/routers/adapters.py` — mask key trong response
- `backend/utils.py` — thêm `encrypt_credential()`, `decrypt_credential()`, `mask_credential()`

**Tests:** `tests/test_security.py::TestCredentialEncryption`

---

### S1-02: JWT Authentication
**Vấn đề hiện tại:** localStorage token = không có bảo mật thật sự.

**Acceptance criteria:**
- [ ] POST `/api/auth/login` nhận `{username, password}`, trả `{access_token, token_type: "bearer"}`
- [ ] JWT có TTL 8h, signed với `SECRET_KEY` env var
- [ ] Tất cả `/api/*` routes (trừ `/api/health`, `/api/auth/login`) yêu cầu Bearer token
- [ ] 401 nếu không có token
- [ ] 401 nếu token expired
- [ ] 403 nếu token invalid
- [ ] POST `/api/auth/refresh` gia hạn token

**Files cần tạo/sửa:**
- `backend/auth.py` — thêm JWT logic (dùng `python-jose`)
- `backend/nautilus_fastapi.py` — apply JWT middleware
- `frontend/src/lib/api.ts` — gửi Bearer token

**Tests:** `tests/test_security.py::TestJWTAuth`

---

### S1-03: Email Notifications
**Vấn đề hiện tại:** Settings email có nhưng không gửi gì cả.

**Acceptance criteria:**
- [ ] Khi alert trigger → nếu email enabled trong settings → gửi email qua SMTP
- [ ] POST `/api/notifications/test-email` gửi test email
- [ ] Config: SMTP host, port, user, password, from_addr, to_addr
- [ ] Gửi async (không block WebSocket thread)
- [ ] Retry tối đa 3 lần nếu SMTP lỗi
- [ ] Test: mock SMTP server, verify `sendmail()` được gọi đúng args

**Files cần tạo/sửa:**
- `backend/notifications.py` — `EmailNotifier`, `TelegramNotifier`
- `backend/alert_monitor.py` — gọi notifier khi trigger
- `backend/routers/system.py` — POST `/api/notifications/test-email`

**Tests:** `tests/test_notifications.py::TestEmailNotification`

---

### S1-04: Telegram Notifications
**Acceptance criteria:**
- [ ] Khi alert trigger → nếu Telegram enabled → gửi message qua Bot API
- [ ] Config: `bot_token`, `chat_id`
- [ ] POST `/api/notifications/test-telegram` gửi test message
- [ ] Test: mock `httpx.AsyncClient.post`, verify URL và payload đúng

**Tests:** `tests/test_notifications.py::TestTelegramNotification`

---

### S1-05: Rate Limiting
**Acceptance criteria:**
- [ ] Mỗi IP không quá 100 req/phút trên toàn bộ API
- [ ] `/api/auth/login` giới hạn 5 lần/phút (brute force protection)
- [ ] 429 Too Many Requests khi vượt giới hạn
- [ ] Header `X-RateLimit-Remaining` trong mọi response

**Files cần sửa:**
- `backend/nautilus_fastapi.py` — dùng `slowapi` hoặc custom middleware

**Tests:** `tests/test_security.py::TestRateLimiting`

---

**Sprint 1 Definition of Done:**
- [ ] Tất cả test trong `test_security.py` PASS
- [ ] Tất cả test trong `test_notifications.py` PASS
- [ ] Không có plaintext credential trong bất kỳ API response nào
- [ ] `REVIEW_OVERVIEW.md` cập nhật score mới

---

## SPRINT 2 — Live Trading MVP
> **Mục tiêu score:** 6.5 → 7.8 · **Ưu tiên:** 🔴 High

### S2-01: LiveTradingNode Setup
**Vấn đề hiện tại:** BacktestEngine only — không có live trading.

**Acceptance criteria:**
- [ ] `LiveTradingNode` (hoặc `TradingNode`) được khởi tạo khi adapter connected
- [ ] Node lifecycle: `initialize()` → `start()` → `stop()`
- [ ] Node trạng thái visible qua GET `/api/engine/info`
- [ ] Graceful shutdown khi server stop

**Files cần tạo/sửa:**
- `backend/live_trading.py` — `LiveTradingManager` class
- `backend/state.py` — tích hợp LiveTradingManager
- `backend/routers/system.py` — expose node status

**Tests:** `tests/test_live_trading.py::TestLiveTradingNode`

---

### S2-02: Binance Spot Adapter (Real)
**Vấn đề hiện tại:** `nautilus_trader.adapters.binance` chưa được import bất kỳ đâu.

**Acceptance criteria:**
- [ ] POST `/api/adapters/binance/connect` → thực sự tạo `BinanceSpotExecutionClient`
- [ ] WebSocket kết nối đến Binance stream
- [ ] Nhận account balance update
- [ ] Status "connected" chỉ set sau khi WS handshake thành công
- [ ] Disconnect đóng WS connection thật
- [ ] Test với Binance sandbox (testnet)

**Files cần sửa:**
- `backend/routers/adapters.py` — gọi LiveTradingManager thay vì DB-only
- `backend/live_trading.py` — thêm `add_binance_adapter()`

**Tests:** `tests/test_live_trading.py::TestBinanceAdapter`

---

### S2-03: Real Order Routing
**Vấn đề hiện tại:** POST `/api/orders` → SQLite only, không đến exchange.

**Acceptance criteria:**
- [ ] Nếu adapter connected: order đi qua `LiveTradingNode.submit_order()`
- [ ] Nếu adapter disconnected: order bị reject với lỗi rõ ràng
- [ ] Order ID từ exchange được lưu vào DB
- [ ] Order status update realtime từ exchange qua WebSocket
- [ ] Cancel order gọi `LiveTradingNode.cancel_order()`

**Tests:** `tests/test_live_trading.py::TestOrderRouting`

---

### S2-04: Live Position Sync
**Vấn đề hiện tại:** Positions chỉ từ backtest results.

**Acceptance criteria:**
- [ ] Khi LiveTradingNode active: positions sync từ exchange mỗi 30s
- [ ] Khi adapter disconnected: positions từ DB (last known state)
- [ ] GET `/api/positions` có field `source: "live" | "cached"`
- [ ] Position close gửi market sell order qua exchange

**Tests:** `tests/test_live_trading.py::TestPositionSync`

---

### S2-05: WebSocket Market Data Feed (Real-time)
**Vấn đề hiện tại:** Market data dùng REST poll 5s.

**Acceptance criteria:**
- [ ] Subscribe Binance WebSocket ticker stream
- [ ] Client nhận update qua `/ws` ngay khi có price change
- [ ] Latency target: < 100ms từ exchange đến client
- [ ] Auto-reconnect nếu WS ngắt (exponential backoff)

**Tests:** `tests/test_live_trading.py::TestMarketDataWebSocket`

---

**Sprint 2 Definition of Done:**
- [ ] Tất cả test trong `test_live_trading.py` PASS (có thể dùng mock exchange)
- [ ] Demo video: đặt order thật trên Binance testnet
- [ ] `REVIEW_OVERVIEW.md` cập nhật score mới

---

## SPRINT 3 — Strategy Runtime & Risk Enforcement
> **Mục tiêu score:** 7.8 → 8.5 · **Ưu tiên:** 🟡 High

### S3-01: Strategy "Start" thực sự chạy
**Vấn đề hiện tại:** Start strategy chỉ đổi status DB.

**Acceptance criteria:**
- [ ] Khi start: strategy được add vào `LiveTradingNode` và bắt đầu nhận ticks
- [ ] Khi stop: strategy dừng nhận ticks, clean up subscriptions
- [ ] Strategy performance (P&L, trades) update real-time qua WS
- [ ] Mỗi strategy có `strategy_id` unique trong engine

**Tests:** `tests/test_strategy_runtime.py::TestStrategyLifecycle`

---

### S3-02: Thêm MACD Strategy
**Acceptance criteria:**
- [ ] Type: `macd`, params: `fast_period`, `slow_period`, `signal_period`
- [ ] Signal logic: MACD line crosses signal line → BUY/SELL
- [ ] Validate: fast < slow
- [ ] Hiển thị trong UI dropdown

**Tests:** `tests/test_strategy_runtime.py::TestMACDStrategy`

---

### S3-03: Risk Limits Enforcement (CRITICAL)
**Vấn đề hiện tại:** Risk limits lưu DB nhưng không được check khi tạo order.

**Acceptance criteria:**
- [ ] Trước khi submit order → check `max_position_size`: 422 nếu vượt
- [ ] Check `max_daily_loss`: block order nếu realized loss hôm nay > limit
- [ ] Check `max_leverage`: 422 nếu order dùng leverage > limit
- [ ] Check `max_orders_per_day`: 429 nếu đã quá số order hôm nay
- [ ] Risk check xảy ra ở middleware level, không phải từng router
- [ ] Test: set limit thấp → tạo order lớn → nhận 422 với message rõ ràng

**Files cần sửa:**
- `backend/routers/orders.py` — gọi risk check trước khi insert
- `backend/risk_engine.py` — `RiskEngine.check_order()` (tạo mới)

**Tests:** `tests/test_risk_enforcement.py::TestRiskLimits`

---

### S3-04: Daily Loss Limit Auto-Stop
**Acceptance criteria:**
- [ ] Background task theo dõi daily P&L
- [ ] Khi daily loss vượt limit: tất cả strategies bị stop tự động
- [ ] WebSocket push event `daily_loss_limit_reached`
- [ ] Admin nhận thông báo (email/Telegram nếu configured)

**Tests:** `tests/test_risk_enforcement.py::TestDailyLossAutoStop`

---

### S3-05: Candlestick Chart
**Acceptance criteria:**
- [ ] BacktestingPage hiển thị OHLC candlestick chart (TradingView lightweight-charts)
- [ ] Interval: 1m, 5m, 15m, 1h, 1d
- [ ] Overlay: SMA lines khi dùng SMA strategy
- [ ] Overlay: RSI panel bên dưới khi dùng RSI strategy

**Tests:** E2E Playwright test

---

**Sprint 3 Definition of Done:**
- [ ] `test_risk_enforcement.py` PASS
- [ ] `test_strategy_runtime.py` PASS
- [ ] Risk limits thực sự block orders
- [ ] `REVIEW_OVERVIEW.md` cập nhật score mới

---

## SPRINT 4 — Production Polish
> **Mục tiêu score:** 8.5 → 9.2 · **Ưu tiên:** 🟢 Medium

### S4-01: Multi-user Support
- User table (id, username, hashed_password, role: admin|trader)
- Mỗi user có strategies/alerts riêng (data isolation)
- Admin có thể xem tất cả
- JWT chứa user_id và role

### S4-02: Bybit Adapter
- `BybitDataClientConfig` + `BybitExecClientConfig`
- Testnet support
- Tương tự Binance adapter

### S4-03: Export Reports (PDF/Excel)
- GET `/api/performance/export?format=pdf|excel`
- Bao gồm: equity curve image, trade list, metrics summary

### S4-04: Audit Log
- Mọi order/trade/login/setting change được log vào `audit_logs` table
- GET `/api/admin/audit-logs` với filter theo user/action/date
- Log không thể xóa (append-only)

### S4-05: Real 2FA (TOTP)
- POST `/api/auth/setup-2fa` → QR code
- POST `/api/auth/verify-2fa` → verify TOTP code
- Optional per-user

---

## MA TRẬN TASK × SPRINT

| Task | Sprint | Score impact | Effort | Priority |
|---|:---:|:---:|:---:|:---:|
| Credential encryption | S1 | +0.5 | S | ⭐⭐⭐⭐⭐ |
| JWT auth | S1 | +0.3 | M | ⭐⭐⭐⭐⭐ |
| Email notifications | S1 | +0.3 | S | ⭐⭐⭐⭐ |
| Telegram notifications | S1 | +0.2 | S | ⭐⭐⭐⭐ |
| Rate limiting | S1 | +0.2 | S | ⭐⭐⭐ |
| LiveTradingNode | S2 | +0.8 | L | ⭐⭐⭐⭐⭐ |
| Binance adapter real | S2 | +0.8 | L | ⭐⭐⭐⭐⭐ |
| Real order routing | S2 | +0.5 | M | ⭐⭐⭐⭐⭐ |
| Live position sync | S2 | +0.3 | M | ⭐⭐⭐⭐ |
| WS market data feed | S2 | +0.2 | M | ⭐⭐⭐⭐ |
| Strategy start real | S3 | +0.4 | M | ⭐⭐⭐⭐⭐ |
| MACD strategy | S3 | +0.2 | S | ⭐⭐⭐⭐ |
| Risk enforcement | S3 | +0.5 | M | ⭐⭐⭐⭐⭐ |
| Daily loss auto-stop | S3 | +0.2 | S | ⭐⭐⭐⭐ |
| Candlestick chart | S3 | +0.1 | S | ⭐⭐⭐ |
| Multi-user | S4 | +0.3 | L | ⭐⭐⭐ |
| Bybit adapter | S4 | +0.2 | M | ⭐⭐⭐⭐ |
| Export reports | S4 | +0.1 | S | ⭐⭐ |
| Audit log | S4 | +0.2 | S | ⭐⭐⭐ |
| Real 2FA | S4 | +0.1 | M | ⭐⭐ |

---

## TEST COVERAGE TARGETS

| Sprint | Test files | Min coverage | Hiện tại |
|---|---|:---:|:---:|
| Baseline | `test_api.py` | 70% | ~65% |
| After S1 | + `test_security.py`, `test_notifications.py` | 75% | — |
| After S2 | + `test_live_trading.py` | 78% | — |
| After S3 | + `test_risk_enforcement.py`, `test_strategy_runtime.py` | 82% | — |
| After S4 | + E2E Playwright | 85% | — |

---

## CÁCH SỬ DỤNG FILE NÀY

1. **Bắt đầu sprint:** Chọn tasks từ sprint, tạo branch `sprint-N/feature-name`
2. **Viết test trước** (TDD): test FAIL là đúng trước khi implement
3. **Implement:** làm cho test PASS
4. **Review score:** cập nhật `REVIEW_OVERVIEW.md`
5. **Merge:** chỉ merge khi `pytest tests/ -v` xanh 100%
6. **Cập nhật file này:** đánh dấu `[x]` các acceptance criteria đã xong

---

*Cập nhật lần cuối: 2026-03-15*
