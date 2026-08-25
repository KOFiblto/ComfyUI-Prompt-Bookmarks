from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from .fingerprint import fingerprint_fields
from .crypto import (
    derive_key,
    encrypt_payload,
    decrypt_payload,
    is_encrypted_payload,
    generate_salt,
    create_verifier,
    verify_key,
)

SCHEMA_VERSION = 2
BACKUP_FORMAT = "comfyui-prompt-bookmarks"
BACKUP_FORMAT_VERSION = 1


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class PromptBookmarksDB:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._session_key: bytes | None = None
        self._init_schema()

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    @staticmethod
    def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
        return {str(row["name"]) for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}

    def _get_meta(self, conn: sqlite3.Connection, key: str, default: str = "") -> str:
        row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return str(row["value"]) if row else default

    def _set_meta(self, conn: sqlite3.Connection, key: str, value: str) -> None:
        conn.execute(
            "INSERT INTO meta(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, str(value)),
        )

    def _set_schema_version(self, conn: sqlite3.Connection, version: int) -> None:
        self._set_meta(conn, "schema_version", str(version))

    def _migrate(self, conn: sqlite3.Connection, current: int) -> None:
        version = current
        if version < 2:
            if "binding_key" not in self._columns(conn, "workflow_bindings"):
                conn.execute("ALTER TABLE workflow_bindings ADD COLUMN binding_key TEXT NOT NULL DEFAULT ''")
            version = 2
            self._set_schema_version(conn, version)
        if version != SCHEMA_VERSION:
            raise RuntimeError(f"Unsupported Prompt Bookmarks schema version: {version}")

    def _init_schema(self) -> None:
        with self._lock, self._conn() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS workflows (
                    workflow_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL DEFAULT '',
                    path TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS workflow_bindings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id TEXT NOT NULL,
                    node_id TEXT NOT NULL,
                    node_type TEXT NOT NULL DEFAULT '',
                    widget_name TEXT NOT NULL,
                    binding_key TEXT NOT NULL DEFAULT '',
                    label TEXT NOT NULL DEFAULT '',
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(workflow_id, node_id, widget_name),
                    FOREIGN KEY(workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS groups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    UNIQUE(workflow_id, name),
                    FOREIGN KEY(workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS prompts (
                    id TEXT PRIMARY KEY,
                    workflow_id TEXT NOT NULL,
                    group_id INTEGER,
                    name TEXT NOT NULL,
                    fields_json TEXT NOT NULL,
                    fingerprint TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_used_at TEXT,
                    use_count INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY(workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE,
                    FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE SET NULL
                );

                CREATE INDEX IF NOT EXISTS idx_prompts_workflow ON prompts(workflow_id);
                CREATE INDEX IF NOT EXISTS idx_prompts_fingerprint ON prompts(workflow_id, fingerprint);

                CREATE TABLE IF NOT EXISTS prompt_media (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prompt_id TEXT NOT NULL,
                    prompt_execution_id TEXT NOT NULL DEFAULT '',
                    filename TEXT NOT NULL,
                    subfolder TEXT NOT NULL DEFAULT '',
                    type TEXT NOT NULL DEFAULT 'output',
                    media_type TEXT NOT NULL DEFAULT 'image',
                    created_at TEXT NOT NULL,
                    UNIQUE(prompt_id, prompt_execution_id, filename, subfolder, type),
                    FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_media_prompt ON prompt_media(prompt_id, id DESC);
                """
            )
            row = conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
            if row is None:
                # Existing 0.1.x databases predate schema metadata. Treat them as v1.
                inferred = 2 if "binding_key" in self._columns(conn, "workflow_bindings") else 1
                self._set_schema_version(conn, inferred)
                current = inferred
            else:
                current = int(row["value"])
            self._migrate(conn, current)

    def schema_version(self) -> int:
        with self._lock, self._conn() as conn:
            row = conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
            return int(row["value"]) if row else 1

    @staticmethod
    def _row(row: sqlite3.Row | None) -> dict[str, Any] | None:
        return dict(row) if row is not None else None

    def upsert_workflow(self, workflow_id: str, name: str = "", path: str = "") -> dict[str, Any]:
        now = utc_now()
        with self._lock, self._conn() as conn:
            conn.execute(
                """
                INSERT INTO workflows(workflow_id, name, path, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(workflow_id) DO UPDATE SET
                    name=excluded.name,
                    path=excluded.path,
                    updated_at=excluded.updated_at
                """,
                (workflow_id, name or "", path or "", now, now),
            )
            return self._row(conn.execute("SELECT * FROM workflows WHERE workflow_id=?", (workflow_id,)).fetchone()) or {}

    def list_workflows(self) -> list[dict[str, Any]]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                """
                SELECT w.*,
                       COUNT(DISTINCT p.id) AS prompt_count,
                       COUNT(DISTINCT b.id) AS binding_count
                FROM workflows w
                LEFT JOIN prompts p ON p.workflow_id=w.workflow_id
                LEFT JOIN workflow_bindings b ON b.workflow_id=w.workflow_id
                GROUP BY w.workflow_id
                ORDER BY w.updated_at DESC
                """
            ).fetchall()
            return [dict(r) for r in rows]

    def get_bindings(self, workflow_id: str) -> list[dict[str, Any]]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM workflow_bindings WHERE workflow_id=? ORDER BY sort_order, id",
                (workflow_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def replace_bindings(self, workflow_id: str, bindings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        with self._lock, self._conn() as conn:
            conn.execute("DELETE FROM workflow_bindings WHERE workflow_id=?", (workflow_id,))
            for index, binding in enumerate(bindings):
                conn.execute(
                    """
                    INSERT INTO workflow_bindings(
                        workflow_id, node_id, node_type, widget_name, binding_key, label, sort_order
                    ) VALUES(?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        workflow_id,
                        str(binding.get("node_id", "")),
                        str(binding.get("node_type", "")),
                        str(binding.get("widget_name", "")),
                        str(binding.get("binding_key", "")),
                        str(binding.get("label", "")),
                        int(binding.get("sort_order", index)),
                    ),
                )
        return self.get_bindings(workflow_id)

    def list_groups(self, workflow_id: str) -> list[dict[str, Any]]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                """
                SELECT g.*, COUNT(p.id) AS prompt_count
                FROM groups g
                LEFT JOIN prompts p ON p.group_id=g.id
                WHERE g.workflow_id=?
                GROUP BY g.id
                ORDER BY g.sort_order, g.name COLLATE NOCASE
                """,
                (workflow_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def create_group(self, workflow_id: str, name: str) -> dict[str, Any]:
        now = utc_now()
        cleaned = name.strip()
        if not cleaned:
            raise ValueError("Group name is required")
        with self._lock, self._conn() as conn:
            row = conn.execute(
                "SELECT id FROM groups WHERE workflow_id=? AND name=?",
                (workflow_id, cleaned),
            ).fetchone()
            if row:
                group_id = row["id"]
            else:
                max_order = conn.execute(
                    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM groups WHERE workflow_id=?",
                    (workflow_id,),
                ).fetchone()["n"]
                cur = conn.execute(
                    "INSERT INTO groups(workflow_id, name, sort_order, created_at) VALUES(?, ?, ?, ?)",
                    (workflow_id, cleaned, max_order, now),
                )
                group_id = cur.lastrowid
            return dict(conn.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone())

    def update_group(self, group_id: int, name: str) -> dict[str, Any] | None:
        cleaned = name.strip()
        if not cleaned:
            raise ValueError("Group name is required")
        with self._lock, self._conn() as conn:
            conn.execute("UPDATE groups SET name=? WHERE id=?", (cleaned, group_id))
            return self._row(conn.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone())

    def delete_group(self, group_id: int) -> bool:
        with self._lock, self._conn() as conn:
            row = conn.execute("SELECT id FROM groups WHERE id=?", (group_id,)).fetchone()
            if row is None:
                return False
            prompt_count = conn.execute(
                "SELECT COUNT(*) AS n FROM prompts WHERE group_id=?",
                (group_id,),
            ).fetchone()["n"]
            if prompt_count:
                raise ValueError("Group is not empty")
            cur = conn.execute("DELETE FROM groups WHERE id=?", (group_id,))
            return cur.rowcount > 0

    def list_prompts(
        self,
        workflow_id: str | None = None,
        group_id: int | None = None,
        query: str = "",
        limit: int = 300,
        sort: str = "recent",
    ) -> list[dict[str, Any]]:
        conditions: list[str] = []
        params: list[Any] = []
        if workflow_id:
            conditions.append("p.workflow_id=?")
            params.append(workflow_id)
        if group_id is not None:
            conditions.append("p.group_id=?")
            params.append(group_id)
        if query.strip():
            conditions.append("(p.name LIKE ? OR p.fields_json LIKE ? OR p.notes LIKE ? OR g.name LIKE ?)")
            needle = f"%{query.strip()}%"
            params.extend([needle, needle, needle, needle])
        where = "WHERE " + " AND ".join(conditions) if conditions else ""
        order_by = {
            "recent": "COALESCE(p.last_used_at, p.updated_at) DESC, p.updated_at DESC",
            "created": "p.created_at DESC, p.updated_at DESC",
            "name": "p.name COLLATE NOCASE ASC, p.updated_at DESC",
            "used": "p.use_count DESC, COALESCE(p.last_used_at, p.updated_at) DESC",
        }.get(sort, "COALESCE(p.last_used_at, p.updated_at) DESC, p.updated_at DESC")
        params.append(max(1, min(limit, 1000)))
        sql = f"""
            SELECT p.*, g.name AS group_name, w.name AS workflow_name, w.path AS workflow_path,
                   (SELECT COUNT(*) FROM prompt_media pm WHERE pm.prompt_id=p.id) AS media_count,
                   (SELECT json_group_array(
                        json_object(
                            'id', id,
                            'filename', filename,
                            'subfolder', subfolder,
                            'type', type,
                            'media_type', media_type,
                            'prompt_execution_id', prompt_execution_id
                        )
                    ) FROM prompt_media WHERE prompt_id=p.id) AS media_list_json,
                   (SELECT json_object(
                        'id', pm2.id,
                        'filename', pm2.filename,
                        'subfolder', pm2.subfolder,
                        'type', pm2.type,
                        'media_type', pm2.media_type,
                        'prompt_execution_id', pm2.prompt_execution_id
                    ) FROM prompt_media pm2 WHERE pm2.prompt_id=p.id ORDER BY pm2.id DESC LIMIT 1) AS latest_media_json
            FROM prompts p
            LEFT JOIN groups g ON g.id=p.group_id
            JOIN workflows w ON w.workflow_id=p.workflow_id
            {where}
            ORDER BY {order_by}
            LIMIT ?
        """
        with self._lock, self._conn() as conn:
            rows = conn.execute(sql, params).fetchall()
            return [self._decode_prompt(dict(r)) for r in rows]

    def is_encrypted(self) -> bool:
        with self._lock, self._conn() as conn:
            val = self._get_meta(conn, "encryption_enabled", "0")
            return val == "1"

    def get_encryption_status(self) -> dict[str, Any]:
        with self._lock, self._conn() as conn:
            enabled = self._get_meta(conn, "encryption_enabled", "0") == "1"
            algorithm = self._get_meta(conn, "encryption_algorithm", "AES-256-GCM")
            salt_hex = self._get_meta(conn, "encryption_salt", "")
            return {
                "enabled": enabled,
                "algorithm": algorithm,
                "unlocked": bool(self._session_key) or not enabled,
                "has_salt": bool(salt_hex),
            }

    def unlock_session(self, password: str) -> bool:
        with self._lock, self._conn() as conn:
            if not self.is_encrypted():
                return True
            salt_hex = self._get_meta(conn, "encryption_salt", "")
            verifier = self._get_meta(conn, "encryption_verifier", "")
            if not salt_hex or not verifier:
                return False
            salt = bytes.fromhex(salt_hex)
            key = derive_key(password, salt)
            if not verify_key(verifier, key):
                return False
            self._session_key = key
            return True

    def lock_session(self) -> None:
        self._session_key = None

    def enable_encryption(self, password: str, algorithm: str = "AES-256-GCM") -> dict[str, Any]:
        if not password or len(password) < 4:
            raise ValueError("Password must be at least 4 characters long")
        salt = generate_salt(16)
        key = derive_key(password, salt)
        verifier = create_verifier(key)

        with self._lock, self._conn() as conn:
            if self._get_meta(conn, "encryption_enabled", "0") == "1":
                raise ValueError("Database is already encrypted")
            rows = conn.execute("SELECT id, fields_json, notes FROM prompts").fetchall()
            count = 0
            for r in rows:
                p_id = r["id"]
                f_json = r["fields_json"]
                n_text = r["notes"] or ""
                enc_fields = encrypt_payload(f_json, key)
                enc_notes = encrypt_payload(n_text, key) if n_text else ""
                conn.execute(
                    "UPDATE prompts SET fields_json=?, notes=? WHERE id=?",
                    (enc_fields, enc_notes, p_id),
                )
                count += 1
            self._set_meta(conn, "encryption_enabled", "1")
            self._set_meta(conn, "encryption_algorithm", algorithm)
            self._set_meta(conn, "encryption_salt", salt.hex())
            self._set_meta(conn, "encryption_verifier", verifier)
            self._session_key = key
            return {"status": "ok", "encrypted_count": count}

    def disable_encryption(self, password: str) -> dict[str, Any]:
        with self._lock, self._conn() as conn:
            if self._get_meta(conn, "encryption_enabled", "0") != "1":
                return {"status": "ok", "decrypted_count": 0}
            salt_hex = self._get_meta(conn, "encryption_salt", "")
            verifier = self._get_meta(conn, "encryption_verifier", "")
            if not salt_hex or not verifier:
                raise ValueError("Invalid encryption metadata")
            salt = bytes.fromhex(salt_hex)
            key = derive_key(password, salt)
            if not verify_key(verifier, key):
                raise ValueError("Incorrect password")
            rows = conn.execute("SELECT id, fields_json, notes FROM prompts").fetchall()
            count = 0
            for r in rows:
                p_id = r["id"]
                dec_fields = decrypt_payload(r["fields_json"], key)
                dec_notes = decrypt_payload(r["notes"] or "", key) if r["notes"] else ""
                conn.execute(
                    "UPDATE prompts SET fields_json=?, notes=? WHERE id=?",
                    (dec_fields, dec_notes, p_id),
                )
                count += 1
            self._set_meta(conn, "encryption_enabled", "0")
            self._set_meta(conn, "encryption_verifier", "")
            self._set_meta(conn, "encryption_salt", "")
            self._session_key = None
            return {"status": "ok", "decrypted_count": count}

    def _decode_prompt(self, row: dict[str, Any]) -> dict[str, Any]:
        raw_fields = row.pop("fields_json")
        raw_notes = row.get("notes", "")
        if is_encrypted_payload(raw_fields):
            if self._session_key:
                try:
                    decrypted_fields = decrypt_payload(raw_fields, self._session_key)
                    row["fields"] = json.loads(decrypted_fields)
                    if is_encrypted_payload(raw_notes):
                        row["notes"] = decrypt_payload(raw_notes, self._session_key)
                    row["is_locked"] = False
                except Exception:
                    row["fields"] = [{"label": "Locked", "widget_name": "text", "value": "[🔒 Encrypted]"}]
                    row["is_locked"] = True
            else:
                row["fields"] = [{"label": "Locked", "widget_name": "text", "value": "[🔒 Encrypted - Unlock with password]"}]
                row["notes"] = "[🔒 Encrypted]"
                row["is_locked"] = True
        else:
            row["fields"] = json.loads(raw_fields)
            row["is_locked"] = False
        media_list_raw = row.pop("media_list_json", None)
        latest = row.pop("latest_media_json", None)
        if row.get("is_locked"):
            row["media"] = []
            row["latest_media"] = None
            row["media_count"] = 0
        else:
            row["media"] = json.loads(media_list_raw) if media_list_raw else []
            row["latest_media"] = json.loads(latest) if latest else (row["media"][0] if row["media"] else None)
        return row

    def get_prompt(self, prompt_id: str) -> dict[str, Any] | None:
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """
                SELECT p.*, g.name AS group_name, w.name AS workflow_name, w.path AS workflow_path,
                       (SELECT COUNT(*) FROM prompt_media pm WHERE pm.prompt_id=p.id) AS media_count,
                       (SELECT json_group_array(
                            json_object(
                                'id', id,
                                'filename', filename,
                                'subfolder', subfolder,
                                'type', type,
                                'media_type', media_type,
                                'prompt_execution_id', prompt_execution_id
                            )
                        ) FROM prompt_media WHERE prompt_id=p.id) AS media_list_json,
                       (SELECT json_object(
                            'id', pm2.id,
                            'filename', pm2.filename,
                            'subfolder', pm2.subfolder,
                            'type', pm2.type,
                            'media_type', pm2.media_type,
                            'prompt_execution_id', pm2.prompt_execution_id
                        ) FROM prompt_media pm2 WHERE pm2.prompt_id=p.id ORDER BY pm2.id DESC LIMIT 1) AS latest_media_json
                FROM prompts p
                LEFT JOIN groups g ON g.id=p.group_id
                JOIN workflows w ON w.workflow_id=p.workflow_id
                WHERE p.id=?
                """,
                (prompt_id,),
            ).fetchone()
            return self._decode_prompt(dict(row)) if row else None

    def create_prompt(
        self,
        workflow_id: str,
        name: str,
        fields: list[dict[str, Any]],
        group_id: int | None = None,
        notes: str = "",
    ) -> dict[str, Any]:
        cleaned = name.strip()
        if not cleaned:
            raise ValueError("Prompt name is required")
        if not fields:
            raise ValueError("At least one prompt field is required")
        prompt_id = str(uuid.uuid4())
        now = utc_now()
        fp = fingerprint_fields(fields)
        fields_json = json.dumps(fields, ensure_ascii=False, separators=(",", ":"))
        notes_to_save = notes or ""
        if self.is_encrypted():
            if not self._session_key:
                raise ValueError("Database is encrypted and locked. Please unlock first.")
            fields_json = encrypt_payload(fields_json, self._session_key)
            if notes_to_save:
                notes_to_save = encrypt_payload(notes_to_save, self._session_key)

        with self._lock, self._conn() as conn:
            conn.execute(
                """
                INSERT INTO prompts(id, workflow_id, group_id, name, fields_json, fingerprint, notes, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (prompt_id, workflow_id, group_id, cleaned, fields_json, fp, notes_to_save, now, now),
            )
        return self.get_prompt(prompt_id) or {}

    def update_prompt(
        self,
        prompt_id: str,
        name: str | None = None,
        fields: list[dict[str, Any]] | None = None,
        group_id: int | None | object = ...,
        notes: str | None = None,
    ) -> dict[str, Any] | None:
        updates: list[str] = []
        params: list[Any] = []
        if name is not None:
            cleaned = name.strip()
            if not cleaned:
                raise ValueError("Prompt name is required")
            updates.append("name=?")
            params.append(cleaned)
        if fields is not None:
            if not fields:
                raise ValueError("At least one prompt field is required")
            f_json = json.dumps(fields, ensure_ascii=False, separators=(",", ":"))
            if self.is_encrypted():
                if not self._session_key:
                    raise ValueError("Database is encrypted and locked. Please unlock first.")
                f_json = encrypt_payload(f_json, self._session_key)
            updates.extend(["fields_json=?", "fingerprint=?"])
            params.extend([
                f_json,
                fingerprint_fields(fields),
            ])
        if group_id is not ...:
            updates.append("group_id=?")
            params.append(group_id)
        if notes is not None:
            n_text = notes
            if self.is_encrypted():
                if not self._session_key:
                    raise ValueError("Database is encrypted and locked. Please unlock first.")
                if n_text:
                    n_text = encrypt_payload(n_text, self._session_key)
            updates.append("notes=?")
            params.append(n_text)
        if not updates:
            return self.get_prompt(prompt_id)
        updates.append("updated_at=?")
        params.append(utc_now())
        params.append(prompt_id)
        with self._lock, self._conn() as conn:
            conn.execute(f"UPDATE prompts SET {', '.join(updates)} WHERE id=?", params)
        return self.get_prompt(prompt_id)

    def delete_prompt(self, prompt_id: str) -> bool:
        with self._lock, self._conn() as conn:
            cur = conn.execute("DELETE FROM prompts WHERE id=?", (prompt_id,))
            return cur.rowcount > 0

    def mark_used(self, prompt_id: str) -> None:
        with self._lock, self._conn() as conn:
            conn.execute(
                "UPDATE prompts SET last_used_at=?, use_count=use_count+1 WHERE id=?",
                (utc_now(), prompt_id),
            )

    def replace_prompt_media(
        self,
        prompt_id: str,
        media_list: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if not prompt_id:
            return []
        now = utc_now()
        with self._lock, self._conn() as conn:
            conn.execute("DELETE FROM prompt_media WHERE prompt_id=?", (prompt_id,))
            for item in media_list:
                filename = str(item.get("filename", "")).strip()
                if not filename:
                    continue
                subfolder = str(item.get("subfolder", ""))
                storage_type = str(item.get("type", "input"))
                media_type = str(item.get("media_type", "image"))
                conn.execute(
                    """
                    INSERT INTO prompt_media(
                        prompt_id, prompt_execution_id, filename, subfolder, type, media_type, created_at
                    ) VALUES(?, ?, ?, ?, ?, ?, ?)
                    """,
                    (prompt_id, "manual", filename, subfolder, storage_type, media_type, now),
                )
        return self.list_media(prompt_id)

    def list_media(self, prompt_id: str) -> list[dict[str, Any]]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM prompt_media WHERE prompt_id=? ORDER BY id DESC",
                (prompt_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def link_media_to_prompt(
        self,
        prompt_id: str,
        filename: str,
        subfolder: str = "",
        media_type: str = "image",
        storage_type: str = "input",
    ) -> bool:
        if not prompt_id or not filename:
            return False
        now = utc_now()
        with self._lock, self._conn() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO prompt_media(
                    prompt_id, prompt_execution_id, filename, subfolder, type, media_type, created_at
                ) VALUES(?, ?, ?, ?, ?, ?, ?)
                """,
                (prompt_id, "manual", filename, subfolder, storage_type, media_type, now),
            )
            return True

    def link_media_by_fields(
        self,
        workflow_id: str,
        fields: list[dict[str, Any]],
        execution_id: str,
        media: list[dict[str, Any]],
    ) -> list[str]:
        if not fields or not media:
            return []
        fp = fingerprint_fields(fields)
        now = utc_now()
        with self._lock, self._conn() as conn:
            prompt_rows = conn.execute(
                "SELECT id FROM prompts WHERE workflow_id=? AND fingerprint=?",
                (workflow_id, fp),
            ).fetchall()
            prompt_ids = [row["id"] for row in prompt_rows]
            for prompt_id in prompt_ids:
                for item in media:
                    filename = str(item.get("filename", "")).strip()
                    if not filename:
                        continue
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO prompt_media(
                            prompt_id, prompt_execution_id, filename, subfolder, type, media_type, created_at
                        ) VALUES(?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            prompt_id,
                            execution_id or "",
                            filename,
                            str(item.get("subfolder", "")),
                            str(item.get("type", "output")),
                            str(item.get("media_type", "image")),
                            now,
                        ),
                    )
            return prompt_ids

    def export_backup(self) -> dict[str, Any]:
        with self._lock, self._conn() as conn:
            workflows: list[dict[str, Any]] = []
            for wf in conn.execute("SELECT * FROM workflows ORDER BY created_at, workflow_id").fetchall():
                workflow_id = str(wf["workflow_id"])
                bindings = [
                    {
                        "node_id": row["node_id"],
                        "node_type": row["node_type"],
                        "widget_name": row["widget_name"],
                        "binding_key": row["binding_key"],
                        "label": row["label"],
                        "sort_order": row["sort_order"],
                    }
                    for row in conn.execute(
                        "SELECT * FROM workflow_bindings WHERE workflow_id=? ORDER BY sort_order, id",
                        (workflow_id,),
                    ).fetchall()
                ]
                groups = [
                    {"name": row["name"], "sort_order": row["sort_order"], "created_at": row["created_at"]}
                    for row in conn.execute(
                        "SELECT * FROM groups WHERE workflow_id=? ORDER BY sort_order, id",
                        (workflow_id,),
                    ).fetchall()
                ]
                group_names = {
                    row["id"]: row["name"]
                    for row in conn.execute("SELECT id, name FROM groups WHERE workflow_id=?", (workflow_id,)).fetchall()
                }
                prompts: list[dict[str, Any]] = []
                for row in conn.execute(
                    "SELECT * FROM prompts WHERE workflow_id=? ORDER BY created_at, id",
                    (workflow_id,),
                ).fetchall():
                    prompt_id = str(row["id"])
                    media = [
                        {
                            "prompt_execution_id": item["prompt_execution_id"],
                            "filename": item["filename"],
                            "subfolder": item["subfolder"],
                            "type": item["type"],
                            "media_type": item["media_type"],
                            "created_at": item["created_at"],
                        }
                        for item in conn.execute(
                            "SELECT * FROM prompt_media WHERE prompt_id=? ORDER BY id",
                            (prompt_id,),
                        ).fetchall()
                    ]
                    prompts.append(
                        {
                            "id": prompt_id,
                            "name": row["name"],
                            "group_name": group_names.get(row["group_id"]),
                            "fields": json.loads(row["fields_json"]),
                            "notes": row["notes"],
                            "created_at": row["created_at"],
                            "updated_at": row["updated_at"],
                            "last_used_at": row["last_used_at"],
                            "use_count": row["use_count"],
                            "media": media,
                        }
                    )
                workflows.append(
                    {
                        "workflow_id": workflow_id,
                        "name": wf["name"],
                        "path": wf["path"],
                        "created_at": wf["created_at"],
                        "updated_at": wf["updated_at"],
                        "bindings": bindings,
                        "groups": groups,
                        "prompts": prompts,
                    }
                )
            return {
                "format": BACKUP_FORMAT,
                "format_version": BACKUP_FORMAT_VERSION,
                "schema_version": SCHEMA_VERSION,
                "exported_at": utc_now(),
                "workflows": workflows,
            }

    def import_backup(self, data: dict[str, Any]) -> dict[str, int]:
        if data.get("format") != BACKUP_FORMAT or int(data.get("format_version", 0)) != BACKUP_FORMAT_VERSION:
            raise ValueError("Unsupported Prompt Bookmarks backup format")
        workflows = data.get("workflows")
        if not isinstance(workflows, list):
            raise ValueError("Backup workflows must be an array")

        counts = {"workflows": 0, "bindings": 0, "groups": 0, "prompts": 0, "media": 0}
        now = utc_now()
        with self._lock, self._conn() as conn:
            for wf in workflows:
                if not isinstance(wf, dict):
                    raise ValueError("Invalid workflow entry in backup")
                workflow_id = str(wf.get("workflow_id", "")).strip()
                if not workflow_id:
                    raise ValueError("Backup workflow_id is required")
                created_at = str(wf.get("created_at") or now)
                updated_at = str(wf.get("updated_at") or created_at)
                conn.execute(
                    """
                    INSERT INTO workflows(workflow_id, name, path, created_at, updated_at)
                    VALUES(?, ?, ?, ?, ?)
                    ON CONFLICT(workflow_id) DO UPDATE SET
                        name=excluded.name,
                        path=excluded.path,
                        updated_at=excluded.updated_at
                    """,
                    (workflow_id, str(wf.get("name", "")), str(wf.get("path", "")), created_at, updated_at),
                )
                counts["workflows"] += 1

                bindings = wf.get("bindings", [])
                if not isinstance(bindings, list):
                    raise ValueError("Backup bindings must be an array")
                conn.execute("DELETE FROM workflow_bindings WHERE workflow_id=?", (workflow_id,))
                for index, binding in enumerate(bindings):
                    if not isinstance(binding, dict):
                        continue
                    node_id = str(binding.get("node_id", ""))
                    widget_name = str(binding.get("widget_name", ""))
                    if not node_id or not widget_name:
                        continue
                    conn.execute(
                        """
                        INSERT INTO workflow_bindings(
                            workflow_id, node_id, node_type, widget_name, binding_key, label, sort_order
                        ) VALUES(?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            workflow_id,
                            node_id,
                            str(binding.get("node_type", "")),
                            widget_name,
                            str(binding.get("binding_key", "")),
                            str(binding.get("label", "")),
                            int(binding.get("sort_order", index)),
                        ),
                    )
                    counts["bindings"] += 1

                group_map: dict[str, int] = {}
                groups = wf.get("groups", [])
                if not isinstance(groups, list):
                    raise ValueError("Backup groups must be an array")
                for index, group in enumerate(groups):
                    if not isinstance(group, dict):
                        continue
                    name = str(group.get("name", "")).strip()
                    if not name:
                        continue
                    row = conn.execute(
                        "SELECT id FROM groups WHERE workflow_id=? AND name=?",
                        (workflow_id, name),
                    ).fetchone()
                    if row:
                        group_id = int(row["id"])
                        conn.execute(
                            "UPDATE groups SET sort_order=? WHERE id=?",
                            (int(group.get("sort_order", index)), group_id),
                        )
                    else:
                        cur = conn.execute(
                            "INSERT INTO groups(workflow_id, name, sort_order, created_at) VALUES(?, ?, ?, ?)",
                            (workflow_id, name, int(group.get("sort_order", index)), str(group.get("created_at") or now)),
                        )
                        group_id = int(cur.lastrowid)
                    group_map[name] = group_id
                    counts["groups"] += 1

                prompts = wf.get("prompts", [])
                if not isinstance(prompts, list):
                    raise ValueError("Backup prompts must be an array")
                for prompt in prompts:
                    if not isinstance(prompt, dict):
                        continue
                    prompt_id = str(prompt.get("id", "")).strip()
                    name = str(prompt.get("name", "")).strip()
                    fields = prompt.get("fields", [])
                    if not prompt_id or not name or not isinstance(fields, list) or not fields:
                        raise ValueError("Invalid prompt entry in backup")
                    group_name = str(prompt.get("group_name") or "").strip()
                    group_id = group_map.get(group_name) if group_name else None
                    if group_name and group_id is None:
                        row = conn.execute(
                            "SELECT id FROM groups WHERE workflow_id=? AND name=?",
                            (workflow_id, group_name),
                        ).fetchone()
                        if row:
                            group_id = int(row["id"])
                        else:
                            cur = conn.execute(
                                "INSERT INTO groups(workflow_id, name, sort_order, created_at) VALUES(?, ?, ?, ?)",
                                (workflow_id, group_name, len(group_map), now),
                            )
                            group_id = int(cur.lastrowid)
                        group_map[group_name] = group_id
                    fields_json = json.dumps(fields, ensure_ascii=False, separators=(",", ":"))
                    created_at = str(prompt.get("created_at") or now)
                    updated_at = str(prompt.get("updated_at") or created_at)
                    conn.execute(
                        """
                        INSERT INTO prompts(
                            id, workflow_id, group_id, name, fields_json, fingerprint, notes,
                            created_at, updated_at, last_used_at, use_count
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            workflow_id=excluded.workflow_id,
                            group_id=excluded.group_id,
                            name=excluded.name,
                            fields_json=excluded.fields_json,
                            fingerprint=excluded.fingerprint,
                            notes=excluded.notes,
                            created_at=excluded.created_at,
                            updated_at=excluded.updated_at,
                            last_used_at=excluded.last_used_at,
                            use_count=excluded.use_count
                        """,
                        (
                            prompt_id,
                            workflow_id,
                            group_id,
                            name,
                            fields_json,
                            fingerprint_fields(fields),
                            str(prompt.get("notes", "")),
                            created_at,
                            updated_at,
                            prompt.get("last_used_at"),
                            max(0, int(prompt.get("use_count", 0) or 0)),
                        ),
                    )
                    counts["prompts"] += 1

                    media = prompt.get("media", [])
                    if not isinstance(media, list):
                        raise ValueError("Backup media must be an array")
                    for item in media:
                        if not isinstance(item, dict):
                            continue
                        filename = str(item.get("filename", "")).strip()
                        if not filename:
                            continue
                        cur = conn.execute(
                            """
                            INSERT OR IGNORE INTO prompt_media(
                                prompt_id, prompt_execution_id, filename, subfolder, type, media_type, created_at
                            ) VALUES(?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                prompt_id,
                                str(item.get("prompt_execution_id", "")),
                                filename,
                                str(item.get("subfolder", "")),
                                str(item.get("type", "output")),
                                str(item.get("media_type", "image")),
                                str(item.get("created_at") or now),
                            ),
                        )
                        if cur.rowcount > 0:
                            counts["media"] += 1
        return counts
