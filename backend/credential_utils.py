"""
Credential encryption utilities — Sprint 1 (S1-01).

Uses Fernet symmetric encryption (AES-128-CBC with HMAC-SHA256).
The encryption key is read from the ENCRYPTION_KEY environment variable.
If not set, a temporary key is generated (data is lost on restart — dev only).
"""

import os
import secrets
from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    """Return a Fernet instance using the configured encryption key."""
    key = os.getenv("ENCRYPTION_KEY", "")
    if not key:
        # Development fallback: generate a fresh key each process lifetime.
        # WARNING: data encrypted with this key cannot be decrypted after restart.
        if not hasattr(_get_fernet, "_dev_key"):
            _get_fernet._dev_key = Fernet.generate_key()
        key_bytes = _get_fernet._dev_key
    else:
        # Accept both raw 32-byte base64url keys and hex-encoded keys
        key_bytes = key.encode() if isinstance(key, str) else key
    return Fernet(key_bytes)


def encrypt_credential(plaintext: str) -> str:
    """Encrypt a plaintext credential string and return a base64 ciphertext string."""
    if not plaintext:
        return ""
    # Strip null bytes (security hardening)
    cleaned = plaintext.replace("\x00", "")
    if not cleaned:
        return ""
    f = _get_fernet()
    return f.encrypt(cleaned.encode()).decode()


def decrypt_credential(ciphertext: str) -> str:
    """Decrypt a base64 ciphertext string back to plaintext. Returns '' on error."""
    if not ciphertext:
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        # Wrong key, corrupt data, or not encrypted → return empty string
        return ""


def mask_credential(plaintext: str, visible_chars: int = 4) -> str:
    """Return a masked version showing only the last N characters: '********abcd'."""
    if not plaintext:
        return "****"
    if len(plaintext) <= visible_chars:
        return "*" * 8
    return "*" * 8 + plaintext[-visible_chars:]
