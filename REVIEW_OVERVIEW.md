# Nautilus Web Interface — Review Tổng Quan

> **Version:** 2.0.0
> **Ngày review:** 2026-03-15
> **Branch:** `claude/review-project-Kvyx9`
> **Reviewer:** Claude Code (tự động)
> **Mục đích:** Đây là tài liệu sống — được cập nhật sau mỗi sprint để theo dõi score tăng theo thời gian.

---

## 1. TỔNG QUAN HỆ THỐNG

### 1.1 Stack kỹ thuật

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| **Frontend** | React + TypeScript | Wouter routing, Tailwind CSS, shadcn/ui components |
| **Backend** | FastAPI + Python 3.11 | asyncio, aiosqlite, uvicorn |
| **Database** | SQLite (`nautilus.db`) | 7 tables, aiosqlite async driver |
| **Nautilus Core** | `BacktestEngine` ✅ · `LiveTradingNode` ❌ | Live trading chưa integrate |
| **Market Data** | Binance public REST API | Cache 5s TTL per symbol, fallback hardcoded |
| **WebSocket** | FastAPI native WS | Heartbeat + push mỗi 3s, broadcast events |
| **Auth** | localStorage API key | Basic only — không phải production auth |
| **Monitoring** | psutil | CPU, Memory, Disk, Uptime |

### 1.2 Sơ đồ kiến trúc tổng thể

```
Browser (React)
    │
    ├── HTTP REST ──────────→ FastAPI Backend
    │   (50+ endpoints)           │
    │                             ├── routers/
    │                             │     ├── strategies.py
    │                             │     ├── backtest.py
    │                             │     ├── orders.py
    │                             │     ├── positions.py
    │                             │     ├── risk.py
    │                             │     ├── alerts.py
    │                             │     ├── market_data.py
    │                             │     ├── adapters.py  ← Fake (DB only)
    │                             │     ├── system.py
    │                             │     ├── components.py
    │                             │     └── database_ops.py
    │                             │
    └── WebSocket /ws ──────→    ├── SQLite (nautilus.db)
        (live push 3s)            │
                                  ├── NautilusTradingSystem (singleton)
                                  │     ├── BacktestEngine ✅ (real)
                                  │     └── LiveTradingNode ❌ (missing)
                                  │
                                  └── External APIs
                                        ├── Binance REST (market data) ✅
                                        └── Exchange adapters ❌ (not connected)
```

### 1.3 Database Schema (7 tables)

| Table | Mục đích | Dữ liệu thật? |
|---|---|:---:|
| `orders` | Lịch sử orders (từ backtest + user tạo) | ⚠️ Hybrid |
| `positions` | Positions mở/đóng | ⚠️ Hybrid |
| `strategies` | Config + status strategies | ✅ Thật |
| `alerts` | Price alerts, trigger status | ✅ Thật |
| `adapter_configs` | Credentials + status adapters | ⚠️ Credentials plaintext |
| `component_states` | Status các engine components | ❌ DB-only, không thật |
| `kv_store` | Key-value cho settings + risk limits | ✅ Thật |

```sql
-- orders: id, instrument, side, type, quantity, price, status, filled_qty, pnl, timestamp
-- positions: id, instrument, side, quantity, entry_price, exit_price, pnl, is_open, strategy_id
-- strategies: id, name, type, status, description, config(JSON), created_at
-- alerts: id, symbol, condition, price, message, status, created_at, triggered_at
-- adapter_configs: adapter_id, api_key(!), api_secret(!), status, last_connected
-- component_states: component_id, status, updated_at
-- kv_store: namespace, key, value
```

### 1.4 Inventory 23 Pages

#### Trader Panel (10 pages)

| Page | Route | Chức năng | Trạng thái |
|---|---|---|:---:|
| TraderDashboard | `/trader` | Tổng quan: counters, components, risk metrics, WS live | ✅ |
| StrategiesPage | `/trader/strategies` | CRUD SMA/RSI strategies, start/stop | ⚠️ |
| OrdersPage | `/trader/orders` | Tạo/xem/cancel orders | ⚠️ |
| PositionsPage | `/trader/positions` | Xem positions + live P&L | ⚠️ |
| BacktestingPage | `/trader/backtesting` | Demo + Real backtest, equity curve | ✅ |
| RiskPage | `/trader/risk` | Xem/sửa risk limits | ⚠️ |
| MarketDataPage | `/trader/market-data` | 6 crypto prices live | ✅ |
| PerformancePage | `/trader/performance` | P&L summary, metrics | ✅ |
| AlertsPage | `/trader/alerts` | Price alerts CRUD + auto-trigger | ✅ |
| _(other)_ | `/trader/*` | Navigation pages | — |

#### Admin Panel (10 pages)

| Page | Route | Chức năng | Trạng thái |
|---|---|---|:---:|
| AdminDashboard | `/admin` | Stats, quick links | ✅ |
| AdaptersPage | `/admin/adapters` | Kết nối 11 exchanges | ❌ |
| ComponentsPage | `/admin/components` | Start/stop engine components | ❌ |
| MonitoringPage | `/admin/monitoring` | CPU/Mem/Disk live metrics | ✅ |
| SettingsPage | `/admin/settings` | Config hệ thống, notification | ⚠️ |
| DatabasePage | `/admin/database` | Backup/restore/optimize | ✅ |
| ApiConfigPage | `/admin/api-config` | API key management | ⚠️ |
| DatabaseMgmtPage | `/admin/db-management` | Database tools | ✅ |

#### Shared (3 pages)

| Page | Route |
|---|---|
| Home | `/` — landing page, chọn Trader/Admin panel |
| LoginPage | — auth form |
| NotFound | `/404` |

### 1.5 Inventory API Endpoints (50+)

#### Strategies (`/api`)
| Endpoint | Method | Status |
|---|:---:|:---:|
| `/strategy-types` | GET | ✅ Real |
| `/strategies` | GET | ✅ Real |
| `/strategies` | POST | ✅ Real |
| `/strategies/{id}` | DELETE | ✅ Real |
| `/strategies/{id}/start` | POST | ⚠️ DB-only |
| `/strategies/{id}/stop` | POST | ⚠️ DB-only |
| `/nautilus/strategies` | GET | ✅ Real |
| `/nautilus/strategies` | POST | ✅ Real |
| `/nautilus/strategies/{id}` | GET | ✅ Real |

#### Backtest (`/api/nautilus`)
| Endpoint | Method | Status |
|---|:---:|:---:|
| `/backtest` | POST | ✅ Real |
| `/backtest/{id}` | GET | ✅ Real |
| `/demo-backtest` | POST | ✅ Real |
| `/system-info` | GET | ✅ Real |
| `/initialize` | POST | ✅ Real |

#### Orders & Positions (`/api`)
| Endpoint | Method | Status |
|---|:---:|:---:|
| `/orders` | GET | ⚠️ Hybrid |
| `/orders` | POST | ❌ Simulated |
| `/orders/{id}` | DELETE | ❌ DB-only |
| `/positions` | GET | ⚠️ Hybrid |
| `/positions/{id}/close` | POST | ❌ DB-only |

#### Risk (`/api/risk`)
| Endpoint | Method | Status |
|---|:---:|:---:|
| `/limits` | GET | ✅ Real |
| `/limits` | POST | ⚠️ Save only, not enforced |
| `/metrics` | GET | ⚠️ Calculated, not live |

#### Market Data (`/api/market-data`)
| Endpoint | Method | Status |
|---|:---:|:---:|
| `/instruments` | GET | ✅ Real (Binance) |
| `/{symbol}` | GET | ✅ Real (Binance) |

#### Alerts (`/api/alerts`)
| Endpoint | Method | Status |
|---|:---:|:---:|
| `` | GET | ✅ Real |
| `` | POST | ✅ Real |
| `/{id}/dismiss` | PUT | ✅ Real |
| `/{id}` | DELETE | ✅ Real |

#### System (`/api`)
| Endpoint | Method | Status |
|---|:---:|:---:|
| `/health` | GET | ✅ Real |
| `/engine/info` | GET | ✅ Real |
| `/engine/initialize` | POST | ✅ Real |
| `/engine/shutdown` | POST | ❌ No-op stub |
| `/components` | GET | ⚠️ DB-based |
| `/system/metrics` | GET | ✅ Real (psutil) |
| `/settings` | GET | ✅ Real |
| `/settings` | POST | ✅ Real |
| `/performance/summary` | GET | ✅ Real |
| `/trades` | GET | ✅ Real |
| `/instruments` | GET | ⚠️ Catalog or defaults |

#### Adapters (`/api`)
| Endpoint | Method | Status |
|---|:---:|:---:|
| `/adapters` | GET | ✅ Real UI |
| `/adapters/{id}` | GET | ✅ Real UI |
| `/adapters/{id}/connect` | POST | ❌ DB-only (no real WS) |
| `/adapters/{id}/disconnect` | POST | ❌ DB-only |

#### Components (`/api/component`)
| Endpoint | Method | Status |
|---|:---:|:---:|
| `/status` | GET | ⚠️ DB-based |
| `/start` | POST | ❌ DB-only |
| `/stop` | POST | ❌ DB-only |
| `/restart` | POST | ❌ DB-only |
| `/configure` | POST | ❌ DB-only |

#### Database Ops (`/api/database`)
| Endpoint | Method | Status |
|---|:---:|:---:|
| `/backup` | POST | ✅ Real |
| `/backups` | GET | ✅ Real |
| `/restore` | POST | ✅ Real |
| `/optimize` | POST | ✅ Real |
| `/clean` | POST | ✅ Real |

### 1.6 Phân loại Real / Hybrid / Fake toàn hệ thống

#### ✅ FULLY REAL (dùng tốt ngay)
- `BacktestEngine` — real Nautilus integration, synthetic + catalog data
- Strategy execution (SMA Crossover, RSI) trong backtest
- Binance market data (REST public, cache 5s)
- Alert monitor + WebSocket trigger
- System metrics (psutil: CPU, Memory, Disk)
- Database persistence (SQLite, backup, restore, optimize)
- Risk limit save/read

#### ⚠️ HYBRID (một phần thật)
- Orders — backtest orders là thật, user-created là simulated
- Positions — từ backtest + live price enrichment
- Strategy start/stop — DB status đúng, engine registration chưa có
- Risk metrics — calculated từ backtest results, không phải live

#### ❌ FAKE / STUB (không làm gì thật)
- Adapter connect/disconnect — chỉ lưu text vào DB
- Test connection — chỉ đọc DB
- Order fill simulation — instant fill, không qua exchange
- Component start/stop — chỉ đổi DB status
- Email/Telegram notifications — settings có, không gửi
- 2FA — setting có, không implement
- Session timeout — setting có, không apply
- Engine shutdown — no-op

### 1.7 Điểm mạnh kiến trúc

| # | Điểm mạnh |
|---|---|
| 1 | Tích hợp **BacktestEngine thật** — SMA, RSI chạy trên dữ liệu thật |
| 2 | **Async/await** đúng chuẩn (asyncio + aiosqlite) — không block |
| 3 | **WebSocket push** cho live UI updates |
| 4 | **Database persistence** đầy đủ — restart không mất data |
| 5 | **Hot backup** SQLite không cần dừng server |
| 6 | **Alert auto-trigger** background task hoạt động thật |
| 7 | Codebase cấu trúc rõ ràng, routers tách biệt |

### 1.8 Điểm yếu kiến trúc

| # | Điểm yếu | Severity |
|---|---|:---:|
| 1 | Không có `LiveTradingNode` — core value proposition missing | 🔴 |
| 2 | Credentials lưu **plaintext** — security risk | 🔴 |
| 3 | Auth là localStorage token — không có real session | 🔴 |
| 4 | Chỉ 2 strategy types (SMA, RSI) — hạn chế người dùng | 🟡 |
| 5 | Risk limits không được enforce khi tạo order | 🟡 |
| 6 | Notifications settings không thực thi | 🟡 |
| 7 | Không có multi-user isolation | 🟡 |
| 8 | Demo backtest dùng GBM synthetic — không phản ánh thị trường thật | 🟢 |

---

## 2. BẢNG ĐIỂM CHỨC NĂNG — SNAPSHOT HIỆN TẠI

### Thang điểm: 0–10 (0 = hoàn toàn fake · 10 = production-ready)

#### NHÓM A — Backtest & Analytics

| Chức năng | Score | Trạng thái | Ghi chú |
|---|:---:|---|---|
| Backtest Demo (SMA + dữ liệu tổng hợp GBM) | 8/10 | ✅ Real | BacktestEngine thật, data GBM synthetic |
| Backtest thật (ParquetDataCatalog) | 7/10 | ✅ Real | Phụ thuộc catalog tại `/home/ubuntu/nautilus_data/catalog` |
| Equity curve chart | 8/10 | ✅ Real | Recharts, dữ liệu từ engine |
| Metrics: Sharpe, MaxDrawdown, Win Rate | 8/10 | ✅ Real | Công thức đúng |
| Performance Summary | 7/10 | ✅ Real | Aggregate từ backtest results |
| Trade History | 7/10 | ✅ Real | Orders từ BacktestEngine |
| **Trung bình nhóm A** | **7.5/10** | | |

#### NHÓM B — Market Data

| Chức năng | Score | Trạng thái | Ghi chú |
|---|:---:|---|---|
| Giá real-time 6 crypto (BTC/ETH/BNB/SOL/ADA/DOT) | 8/10 | ✅ Real | Binance REST public, cache 5s |
| 24h change, Volume, Bid/Ask | 7/10 | ✅ Real | Binance ticker |
| Price enrichment cho Positions | 7/10 | ✅ Real | Live price → P&L tính đúng |
| **Trung bình nhóm B** | **7.3/10** | | |

#### NHÓM C — Strategy Management

| Chức năng | Score | Trạng thái | Ghi chú |
|---|:---:|---|---|
| Tạo/xóa strategy SMA Crossover | 7/10 | ✅ Real | Validate fast < slow, lưu DB |
| Tạo/xóa strategy RSI | 7/10 | ✅ Real | Period 14–200 |
| Start strategy | 4/10 | ⚠️ Partial | Chỉ đổi status DB, không chạy live |
| Stop strategy | 4/10 | ⚠️ Partial | Chỉ đổi status DB |
| Strategy performance live update | 3/10 | ❌ Fake | Metrics từ lần backtest cũ |
| Thêm strategy types (MACD, Bollinger…) | 0/10 | ❌ Thiếu | Chỉ có 2 types |
| **Trung bình nhóm C** | **4.2/10** | | |

#### NHÓM D — Alerts

| Chức năng | Score | Trạng thái | Ghi chú |
|---|:---:|---|---|
| Tạo alert giá (above/below) | 8/10 | ✅ Real | Lưu DB, monitor thật |
| Auto-trigger alert | 7/10 | ✅ Real | Background task check Binance |
| WebSocket push khi trigger | 7/10 | ✅ Real | Broadcast qua WS |
| Dismiss/Delete alert | 8/10 | ✅ Real | CRUD đầy đủ |
| **Email/Telegram khi trigger** | **0/10** | ❌ Thiếu | Setting có, không gửi |
| **Trung bình nhóm D** | **6.0/10** | | |

#### NHÓM E — System Monitoring

| Chức năng | Score | Trạng thái | Ghi chú |
|---|:---:|---|---|
| CPU, Memory, Disk (psutil) | 9/10 | ✅ Real | Thật 100% |
| Uptime tracking | 9/10 | ✅ Real | Từ server start |
| Health check | 8/10 | ✅ Real | Ping DB + Binance + engine |
| Live metrics qua WebSocket | 7/10 | ✅ Real | Push 3s |
| Export metrics JSON | 8/10 | ✅ Real | |
| **Trung bình nhóm E** | **8.2/10** | | |

#### NHÓM F — Database Operations

| Chức năng | Score | Trạng thái | Ghi chú |
|---|:---:|---|---|
| Backup (sqlite3.backup hot) | 9/10 | ✅ Real | |
| Restore (safety snapshot) | 8/10 | ✅ Real | |
| Optimize (VACUUM + ANALYZE) | 9/10 | ✅ Real | |
| Clean old records (>30 ngày) | 8/10 | ✅ Real | |
| **Trung bình nhóm F** | **8.5/10** | | |

#### NHÓM G — Orders & Positions

| Chức năng | Score | Trạng thái | Ghi chú |
|---|:---:|---|---|
| Xem orders từ backtest | 7/10 | ✅ Real | Orders thật từ BacktestEngine |
| Tạo order thủ công | 3/10 | ❌ Simulated | Lưu DB, MARKET fill ngay, không đến exchange |
| Cancel order | 4/10 | ⚠️ DB-only | Chỉ đổi status DB |
| Xem positions | 6/10 | ⚠️ Hybrid | Từ backtest + live price enrichment |
| Close position | 3/10 | ❌ DB-only | Chỉ mark `is_open=0` |
| P&L tính live | 7/10 | ✅ Real | Dùng Binance price thật |
| **Risk check khi tạo order** | **0/10** | ❌ Thiếu | Không validate limits |
| **Trung bình nhóm G** | **4.3/10** | | |

#### NHÓM H — Adapters

| Chức năng | Score | Trạng thái | Ghi chú |
|---|:---:|---|---|
| Xem danh sách 11 adapters | 6/10 | ✅ Real UI | Hiển thị đúng |
| Connect (lưu credentials) | 1/10 | ❌ Fake | Chỉ lưu text "connected" vào DB |
| Disconnect | 1/10 | ❌ Fake | Chỉ lưu text "disconnected" |
| Test connection | 0/10 | ❌ Fake | Chỉ đọc DB, không ping exchange |
| Credentials encryption | 0/10 | ❌ Nguy hiểm | Lưu **plaintext** trong SQLite |
| LiveTradingNode | 0/10 | ❌ Không tồn tại | BacktestEngine only |
| **Trung bình nhóm H** | **1.3/10** | | |

#### NHÓM I — Settings

| Chức năng | Score | Trạng thái | Ghi chú |
|---|:---:|---|---|
| Lưu/đọc settings | 7/10 | ✅ Real | SQLite key-value |
| Risk limits | 6/10 | ⚠️ Partial | Lưu OK, không enforce |
| Email notifications | 0/10 | ❌ Fake | Setting có, không gửi |
| Slack notifications | 0/10 | ❌ Fake | |
| Telegram notifications | 0/10 | ❌ Thiếu | Không có |
| 2FA | 0/10 | ❌ Fake | Setting có, không implement |
| Session timeout | 2/10 | ❌ Fake | Lưu setting, không apply |
| **Trung bình nhóm I** | **2.1/10** | | |

#### NHÓM J — Components Management

| Chức năng | Score | Trạng thái | Ghi chú |
|---|:---:|---|---|
| Xem component status | 5/10 | ⚠️ Partial | Status từ DB, không phản ánh thật |
| Start/Stop/Restart component | 2/10 | ❌ DB-only | Không thực sự control gì |
| **Trung bình nhóm J** | **3.5/10** | | |

---

## 3. BẢNG TỔNG HỢP ĐIỂM

```
Nhóm A  Backtest & Analytics      ████████░░  7.5/10  ✅
Nhóm B  Market Data               ███████░░░  7.3/10  ✅
Nhóm C  Strategy Management       ████░░░░░░  4.2/10  ⚠️
Nhóm D  Alerts                    ██████░░░░  6.0/10  ⚠️
Nhóm E  System Monitoring         ████████░░  8.2/10  ✅
Nhóm F  Database Operations       █████████░  8.5/10  ✅
Nhóm G  Orders & Positions        ████░░░░░░  4.3/10  ⚠️
Nhóm H  Adapters (Live Trading)   █░░░░░░░░░  1.3/10  ❌
Nhóm I  Settings & Notifications  ██░░░░░░░░  2.1/10  ❌
Nhóm J  Components Management     ███░░░░░░░  3.5/10  ❌
─────────────────────────────────────────────────────
TỔNG THỂ                          █████░░░░░  5.3/10
```

> **Score tổng: 5.3/10** — Phù hợp làm demo/học Nautilus. Chưa phù hợp live trading.

---

## 4. VẤN ĐỀ BẢO MẬT NGHIÊM TRỌNG

| # | Vấn đề | Mức độ nguy hiểm |
|---|---|:---:|
| 1 | API key / secret lưu **plaintext** trong SQLite | 🔴 CRITICAL |
| 2 | Auth chỉ là localStorage token, không có session | 🔴 HIGH |
| 3 | Không có HTTPS enforcement | 🟡 MEDIUM |
| 4 | Không có rate limiting | 🟡 MEDIUM |
| 5 | Không có CSRF protection | 🟡 MEDIUM |
| 6 | Không có audit log cho order/trades | 🟡 MEDIUM |

---

## 5. KIẾN TRÚC GAP — LIVE TRADING

```
Web Interface hiện tại:
  POST /api/orders → SQLite (simulated fill)
  POST /api/adapters/binance/connect → SQLite (text only)

Cần để live trading:
  POST /api/orders → LiveTradingNode → BinanceSpotExecutionClient
                                     → Binance WebSocket → Exchange
  POST /api/adapters/binance/connect → TradingNode.add_data_client()
                                     → Encrypted creds
                                     → Real WebSocket handshake
```

---

## 6. LỊCH SỬ REVIEW (cập nhật sau mỗi sprint)

| Ngày | Event | Score trước | Score sau | Ghi chú |
|---|---|:---:|:---:|---|
| 2026-03-15 | Baseline review | — | **5.3/10** | Audit ban đầu |
| _(Sprint 1)_ | Security + Notifications | 5.3 | _(dự kiến 6.5)_ | Mã hóa creds, email/TG |
| _(Sprint 2)_ | Live Trading MVP | 6.5 | _(dự kiến 7.8)_ | LiveTradingNode + Binance |
| _(Sprint 3)_ | Strategy Runtime + Risk | 7.8 | _(dự kiến 8.5)_ | Real strategy + enforce risk |
| _(Sprint 4)_ | Polish + Multi-user | 8.5 | _(dự kiến 9.2)_ | Production-ready |

---

## 7. CÁCH CẬP NHẬT REVIEW NÀY

Sau mỗi sprint hoàn thành, chạy:

```bash
# 1. Chạy toàn bộ test suite
cd backend && pytest tests/ -v --tb=short

# 2. Chạy E2E tests
cd e2e && npx playwright test

# 3. Tự đánh giá lại từng chức năng trong file này
# 4. Cập nhật bảng điểm Section 2
# 5. Cập nhật bảng tổng hợp Section 3
# 6. Ghi vào lịch sử review Section 6
```

---

*File này được duy trì bởi team. Không xóa lịch sử review cũ — chỉ thêm mới.*
