# Nautilus Web Interface — Review Tổng Quan

> **Version:** 2.0.0
> **Ngày review:** 2026-03-15
> **Branch:** `claude/review-project-Kvyx9`
> **Reviewer:** Claude Code (tự động)
> **Mục đích:** Đây là tài liệu sống — được cập nhật sau mỗi sprint để theo dõi score tăng theo thời gian.

---

## 1. TỔNG QUAN HỆ THỐNG

| Mục | Giá trị |
|---|---|
| Frontend | React + TypeScript, Wouter routing, Tailwind CSS, shadcn/ui |
| Backend | FastAPI + Python, asyncio, aiosqlite |
| Nautilus tích hợp | `BacktestEngine` (thật), `LiveTradingNode` (CHƯA CÓ) |
| Database | SQLite (`nautilus.db`) — 7 tables |
| Market data | Binance public REST API (cache 5s) |
| WebSocket | FastAPI WS — heartbeat + push 3s |
| Auth | localStorage API key (basic) |
| Tests | 59 unit tests — 59/59 pass |
| API Endpoints | ~50+ endpoints |
| Pages | 23 pages (Trader + Admin) |

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
