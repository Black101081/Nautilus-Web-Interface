"""
Notification service — Sprint 1 (S1-03/S1-04).

Provides EmailNotifier and TelegramNotifier.
Both are called when an alert is triggered (see database.trigger_alert).
"""

import asyncio
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict

import httpx


class EmailNotifier:
    """Sends alert emails via SMTP with up to 3 retry attempts."""

    async def send(
        self,
        subject: str,
        body: str,
        to: str,
        settings: Dict[str, Any] = None,
    ) -> None:
        """Send an email.  Raises on persistent failure after 3 attempts."""
        settings = settings or {}
        smtp_host = settings.get("smtp_host", "")
        smtp_port = int(settings.get("smtp_port", 587))
        smtp_user = settings.get("smtp_user", "")
        smtp_password = settings.get("smtp_password", "")
        from_addr = settings.get("smtp_from", smtp_user) or smtp_user

        if not smtp_host or not to:
            return  # Not configured — silently skip

        msg = MIMEMultipart("alternative")
        msg["From"] = from_addr
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))

        last_exc: Exception = RuntimeError("Unknown SMTP error")
        for attempt in range(3):
            try:
                context = ssl.create_default_context()
                with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                    server.starttls(context=context)
                    if smtp_user and smtp_password:
                        server.login(smtp_user, smtp_password)
                    server.sendmail(from_addr, to, msg.as_string())
                return  # Success
            except Exception as exc:
                last_exc = exc
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)

        raise last_exc


class TelegramNotifier:
    """Sends messages via Telegram Bot API."""

    async def send(self, text: str, bot_token: str, chat_id: str) -> None:
        """Send a Telegram message. No retry (Telegram API is reliable)."""
        if not bot_token or not chat_id:
            return
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                url,
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            )


# ── Module-level notifier singletons ─────────────────────────────────────────

email_notifier = EmailNotifier()
telegram_notifier = TelegramNotifier()


async def notify_alert_triggered(alert: dict) -> None:
    """
    Send email and/or Telegram notification when an alert is triggered.
    Called by database.trigger_alert() after the DB update.
    Settings are read live from the database on each call.
    """
    import database  # lazy import to avoid circular dependency

    settings_data = await database.get_settings()
    notif: dict = settings_data.get("notifications", {})

    symbol = alert.get("symbol", "")
    condition = alert.get("condition", "")
    price = alert.get("price", 0)
    message_text = alert.get("message", "")

    subject = f"Alert Triggered: {symbol} {condition} {price}"
    email_body = (
        f"<h2>Price Alert Triggered</h2>"
        f"<p><b>Symbol:</b> {symbol}</p>"
        f"<p><b>Condition:</b> {condition} {price}</p>"
        f"<p><b>Message:</b> {message_text}</p>"
    )

    # ── Email ────────────────────────────────────────────────────────────────
    if notif.get("email_enabled") and notif.get("email_to"):
        try:
            await email_notifier.send(
                subject=subject,
                body=email_body,
                to=notif["email_to"],
                settings=notif,
            )
        except Exception as exc:
            # Log but don't re-raise — notifications are best-effort
            import logging
            logging.getLogger(__name__).warning("Email notification failed: %s", exc)

    # ── Telegram ──────────────────────────────────────────────────────────────
    if notif.get("telegram_enabled") and notif.get("telegram_bot_token"):
        try:
            tg_text = (
                f"🚨 <b>{symbol}</b> alert: {condition} {price}"
                + (f"\n{message_text}" if message_text else "")
            )
            await telegram_notifier.send(
                text=tg_text,
                bot_token=notif["telegram_bot_token"],
                chat_id=notif.get("telegram_chat_id", ""),
            )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Telegram notification failed: %s", exc)
