from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class PairedDevice:
    device_id: str
    label: str
    created_at: str
    last_seen_at: Optional[str]


class PairingStore:
    """Keeps only hashes of issued phone tokens; never saves chat content."""

    def __init__(self, state_dir: Path):
        state_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(state_dir / "companion.sqlite3", check_same_thread=False)
        self._connection.execute("PRAGMA foreign_keys = ON")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS paired_devices (
                device_id TEXT PRIMARY KEY NOT NULL,
                label TEXT NOT NULL,
                token_digest TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_seen_at TEXT,
                revoked_at TEXT
            )
            """
        )
        self._connection.commit()

    def issue_token(self, device_id: str, label: str) -> str:
        token = secrets.token_urlsafe(32)
        now = utc_now()
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO paired_devices(device_id, label, token_digest, created_at, last_seen_at, revoked_at)
                VALUES (?, ?, ?, ?, ?, NULL)
                ON CONFLICT(device_id) DO UPDATE SET
                    label = excluded.label,
                    token_digest = excluded.token_digest,
                    created_at = excluded.created_at,
                    last_seen_at = excluded.last_seen_at,
                    revoked_at = NULL
                """,
                (device_id, label, token_digest(token), now, now),
            )
            self._connection.commit()
        return token

    def authorize(self, token: str) -> Optional[PairedDevice]:
        digest = token_digest(token)
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT device_id, label, created_at, last_seen_at, token_digest
                FROM paired_devices
                WHERE revoked_at IS NULL
                """
            ).fetchall()
            for device_id, label, created_at, last_seen_at, stored_digest in rows:
                if hmac.compare_digest(stored_digest, digest):
                    now = utc_now()
                    self._connection.execute(
                        "UPDATE paired_devices SET last_seen_at = ? WHERE device_id = ?", (now, device_id)
                    )
                    self._connection.commit()
                    return PairedDevice(device_id, label, created_at, now)
        return None

    def revoke(self, token: str) -> bool:
        digest = token_digest(token)
        with self._lock:
            rows = self._connection.execute(
                "SELECT device_id, token_digest FROM paired_devices WHERE revoked_at IS NULL"
            ).fetchall()
            for device_id, stored_digest in rows:
                if hmac.compare_digest(stored_digest, digest):
                    self._connection.execute(
                        "UPDATE paired_devices SET revoked_at = ? WHERE device_id = ?", (utc_now(), device_id)
                    )
                    self._connection.commit()
                    return True
        return False

    def close(self) -> None:
        with self._lock:
            self._connection.close()
