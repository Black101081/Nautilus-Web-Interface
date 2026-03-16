"""
Notification tests — Sprint 1.

Tests for email and Telegram notification delivery when alerts trigger.

Run:
    cd backend
    pytest tests/test_notifications.py -v
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def client(tmp_path, monkeypatch):
    import database
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    from fastapi.testclient import TestClient
    from nautilus_fastapi import app
    with TestClient(app) as c:
        login_r = c.post("/api/auth/login", json={"username": "admin", "password": "admin"})
        if login_r.status_code == 200:
            token = login_r.json()["access_token"]
            c.headers.update({"Authorization": f"Bearer {token}"})
        yield c


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Email Notifications
# ═════════════════════════════════════════════════════════════════════════════

class TestEmailNotification:

    def test_email_sent_when_alert_triggered(self, client):
        """When an alert is triggered, an email must be sent if email is enabled."""
        import asyncio
        import database

        # Enable email notifications
        client.post(
            "/api/settings",
            json={
                "notifications": {
                    "email_enabled": True,
                    "email_to": "trader@example.com",
                    "smtp_host": "localhost",
                    "smtp_port": 587,
                    "smtp_user": "noreply@example.com",
                    "smtp_password": "smtp_pass",
                }
            },
        )

        # Create an alert
        r = client.post(
            "/api/alerts",
            json={"symbol": "BTCUSDT", "condition": "above", "price": 1.0},
        )
        alert_id = r.json()["alert"]["id"]

        # Trigger the alert and verify email was queued
        with patch("notifications.EmailNotifier.send", new_callable=AsyncMock) as mock_send:
            asyncio.run(database.trigger_alert(alert_id))
            mock_send.assert_called_once()
            call_args = mock_send.call_args
            assert "BTCUSDT" in str(call_args) or "alert" in str(call_args).lower()

    def test_email_not_sent_when_disabled(self, client):
        """When email notifications are disabled, no email should be sent."""
        import asyncio
        import database

        client.post(
            "/api/settings",
            json={"notifications": {"email_enabled": False}},
        )

        r = client.post(
            "/api/alerts",
            json={"symbol": "ETHUSDT", "condition": "above", "price": 1.0},
        )
        alert_id = r.json()["alert"]["id"]

        with patch("notifications.EmailNotifier.send", new_callable=AsyncMock) as mock_send:
            asyncio.run(database.trigger_alert(alert_id))
            mock_send.assert_not_called()

    def test_send_test_email_endpoint(self, client):
        """POST /api/notifications/test-email must attempt to send a test email."""
        with patch("notifications.EmailNotifier.send", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = True
            r = client.post(
                "/api/notifications/test-email",
                json={"email": "test@example.com"},
            )
            assert r.status_code == 200
            body = r.json()
            assert body.get("success") is True
            mock_send.assert_called_once()

    def test_email_contains_alert_details(self, client):
        """Email body must include: symbol, condition, price, timestamp."""
        import asyncio
        import database

        client.post(
            "/api/settings",
            json={"notifications": {"email_enabled": True, "email_to": "x@x.com"}},
        )

        r = client.post(
            "/api/alerts",
            json={"symbol": "SOLUSDT", "condition": "above", "price": 200.0},
        )
        alert_id = r.json()["alert"]["id"]

        captured_emails = []

        async def capture_send(subject, body, to):
            captured_emails.append({"subject": subject, "body": body, "to": to})

        with patch("notifications.EmailNotifier.send", side_effect=capture_send):
            asyncio.run(database.trigger_alert(alert_id))

        assert len(captured_emails) == 1
        email = captured_emails[0]
        assert "SOLUSDT" in email["body"] or "SOLUSDT" in email["subject"]
        assert "200" in email["body"]

    def test_email_retries_on_smtp_error(self, client):
        """If SMTP fails, email delivery must be retried up to 3 times."""
        import asyncio
        import database

        client.post(
            "/api/settings",
            json={"notifications": {"email_enabled": True, "email_to": "x@x.com"}},
        )

        r = client.post(
            "/api/alerts",
            json={"symbol": "BTCUSDT", "condition": "above", "price": 1.0},
        )
        alert_id = r.json()["alert"]["id"]

        call_count = 0

        async def failing_send(subject, body, to):
            nonlocal call_count
            call_count += 1
            raise ConnectionError("SMTP unavailable")

        with patch("notifications.EmailNotifier.send", side_effect=failing_send):
            asyncio.run(database.trigger_alert(alert_id))

        assert call_count >= 3, f"Expected at least 3 retries, got {call_count}"


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Telegram Notifications
# ═════════════════════════════════════════════════════════════════════════════

class TestTelegramNotification:

    def test_telegram_message_sent_on_trigger(self, client):
        """When alert triggers and Telegram enabled, Bot API must be called."""
        import asyncio
        import database

        client.post(
            "/api/settings",
            json={
                "notifications": {
                    "telegram_enabled": True,
                    "telegram_bot_token": "bot123:ABC",
                    "telegram_chat_id": "456789",
                }
            },
        )

        r = client.post(
            "/api/alerts",
            json={"symbol": "BTCUSDT", "condition": "below", "price": 999999.0},
        )
        alert_id = r.json()["alert"]["id"]

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = MagicMock(status_code=200, json=lambda: {"ok": True})
            asyncio.run(database.trigger_alert(alert_id))

            mock_post.assert_called_once()
            call_url = mock_post.call_args[0][0]
            assert "api.telegram.org" in call_url
            assert "bot123:ABC" in call_url

    def test_telegram_not_sent_when_disabled(self, client):
        """Telegram must not be called when disabled."""
        import asyncio
        import database

        client.post(
            "/api/settings",
            json={"notifications": {"telegram_enabled": False}},
        )

        r = client.post(
            "/api/alerts",
            json={"symbol": "ETHUSDT", "condition": "above", "price": 1.0},
        )
        alert_id = r.json()["alert"]["id"]

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            asyncio.run(database.trigger_alert(alert_id))
            mock_post.assert_not_called()

    def test_send_test_telegram_endpoint(self, client):
        """POST /api/notifications/test-telegram sends a test message."""
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = MagicMock(status_code=200, json=lambda: {"ok": True})
            r = client.post(
                "/api/notifications/test-telegram",
                json={"bot_token": "bot123:ABC", "chat_id": "456"},
            )
            assert r.status_code == 200
            assert r.json().get("success") is True

    def test_telegram_message_contains_symbol_and_price(self, client):
        """Telegram message must include the alert symbol and threshold price."""
        import asyncio
        import database

        client.post(
            "/api/settings",
            json={
                "notifications": {
                    "telegram_enabled": True,
                    "telegram_bot_token": "bot:XYZ",
                    "telegram_chat_id": "111",
                }
            },
        )

        r = client.post(
            "/api/alerts",
            json={"symbol": "BNBUSDT", "condition": "above", "price": 750.0},
        )
        alert_id = r.json()["alert"]["id"]

        posted_texts = []

        async def capture_post(url, **kwargs):
            posted_texts.append(kwargs.get("json", {}).get("text", ""))
            return MagicMock(status_code=200, json=lambda: {"ok": True})

        with patch("httpx.AsyncClient.post", side_effect=capture_post):
            asyncio.run(database.trigger_alert(alert_id))

        assert posted_texts, "No Telegram message was sent"
        msg = posted_texts[0]
        assert "BNBUSDT" in msg
        assert "750" in msg


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Notification Settings
# ═════════════════════════════════════════════════════════════════════════════

class TestNotificationSettings:

    def test_settings_persist_email_config(self, client):
        """Email notification settings must persist to DB."""
        client.post(
            "/api/settings",
            json={
                "notifications": {
                    "email_enabled": True,
                    "email_to": "save_test@example.com",
                }
            },
        )
        r = client.get("/api/settings")
        notif = r.json().get("notifications", {})
        assert notif.get("email_enabled") is True
        assert notif.get("email_to") == "save_test@example.com"

    def test_settings_persist_telegram_config(self, client):
        """Telegram notification settings must persist to DB."""
        client.post(
            "/api/settings",
            json={
                "notifications": {
                    "telegram_enabled": True,
                    "telegram_chat_id": "12345678",
                }
            },
        )
        r = client.get("/api/settings")
        notif = r.json().get("notifications", {})
        assert notif.get("telegram_enabled") is True
        assert notif.get("telegram_chat_id") == "12345678"

    def test_telegram_bot_token_not_in_plain_settings(self, client):
        """Telegram bot token must not appear plaintext in GET /api/settings."""
        client.post(
            "/api/settings",
            json={
                "notifications": {
                    "telegram_bot_token": "bot999:SUPER_SECRET_TOKEN",
                }
            },
        )
        r = client.get("/api/settings")
        assert "SUPER_SECRET_TOKEN" not in r.text, \
            "Bot token must not appear in plain text in GET /api/settings"

    def test_smtp_password_not_in_plain_settings(self, client):
        """SMTP password must not appear plaintext in GET /api/settings."""
        client.post(
            "/api/settings",
            json={
                "notifications": {
                    "smtp_password": "MY_SMTP_PASSWORD_XYZ",
                }
            },
        )
        r = client.get("/api/settings")
        assert "MY_SMTP_PASSWORD_XYZ" not in r.text, \
            "SMTP password must not appear in plain text in GET response"
