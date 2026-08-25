from __future__ import annotations

import base64
import hashlib
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

VERIFIER_SENTINEL = "VERIFY:comfyui-prompt-bookmarks:ok"
DEFAULT_ITERATIONS = 100_000
KEY_LENGTH = 32  # 256 bits


def generate_salt(length: int = 16) -> bytes:
    return os.urandom(length)


def derive_key(password: str, salt: bytes, iterations: int = DEFAULT_ITERATIONS) -> bytes:
    if not password:
        raise ValueError("Password cannot be empty")
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=KEY_LENGTH,
    )


def encrypt_payload(data: str, key: bytes) -> str:
    """
    Encrypts a plaintext string with AES-256-GCM.
    Output format: enc:v1:aes256gcm:<iv_b64>:<ciphertext_b64>
    """
    if not data:
        return ""
    data_bytes = data.encode("utf-8")
    iv = os.urandom(12)  # Standard 96-bit nonce for AES-GCM
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, data_bytes, None)
    iv_b64 = base64.b64encode(iv).decode("ascii")
    ct_b64 = base64.b64encode(ciphertext).decode("ascii")
    return f"enc:v1:aes256gcm:{iv_b64}:{ct_b64}"


def is_encrypted_payload(payload: str) -> bool:
    return isinstance(payload, str) and payload.startswith("enc:v1:aes256gcm:")


def decrypt_payload(payload: str, key: bytes) -> str:
    """
    Decrypts an AES-256-GCM payload string.
    If payload is not encrypted, returns it as-is.
    """
    if not payload or not is_encrypted_payload(payload):
        return payload
    parts = payload.split(":")
    if len(parts) != 5 or parts[0] != "enc" or parts[1] != "v1" or parts[2] != "aes256gcm":
        raise ValueError("Unsupported or invalid encrypted payload format")
    iv = base64.b64decode(parts[3])
    ciphertext = base64.b64decode(parts[4])
    aesgcm = AESGCM(key)
    decrypted_bytes = aesgcm.decrypt(iv, ciphertext, None)
    return decrypted_bytes.decode("utf-8")


def create_verifier(key: bytes) -> str:
    return encrypt_payload(VERIFIER_SENTINEL, key)


def verify_key(verifier: str, key: bytes) -> bool:
    try:
        decrypted = decrypt_payload(verifier, key)
        return decrypted == VERIFIER_SENTINEL
    except Exception:
        return False
