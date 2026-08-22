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


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class PromptBookmarksDB:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
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

    def _init_schema(self) -> None:
        with self._lock, self._conn() as conn:
            conn.executescript(
                """
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
                    INSERT INTO workflow_bindings(workflow_id, node_id, node_type, widget_name, label, sort_order)
                    VALUES(?, ?, ?, ?, ?, ?)
                    """,
                    (
                        workflow_id,
                        str(binding.get("node_id", "")),
                        str(binding.get("node_type", "")),
                        str(binding.get("widget_name", "")),
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
            cur = conn.execute("DELETE FROM groups WHERE id=?", (group_id,))
            return cur.rowcount > 0

    def list_prompts(
        self,
        workflow_id: str | None = None,
        group_id: int | None = None,
        query: str = "",
        limit: int = 300,
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
        params.append(max(1, min(limit, 1000)))
        sql = f"""
            SELECT p.*, g.name AS group_name, w.name AS workflow_name, w.path AS workflow_path,
                   (SELECT COUNT(*) FROM prompt_media pm WHERE pm.prompt_id=p.id) AS media_count,
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
            ORDER BY COALESCE(p.last_used_at, p.updated_at) DESC, p.updated_at DESC
            LIMIT ?
        """
        with self._lock, self._conn() as conn:
            rows = conn.execute(sql, params).fetchall()
            return [self._decode_prompt(dict(r)) for r in rows]

    def _decode_prompt(self, row: dict[str, Any]) -> dict[str, Any]:
        row["fields"] = json.loads(row.pop("fields_json"))
        latest = row.pop("latest_media_json", None)
        row["latest_media"] = json.loads(latest) if latest else None
        return row

    def get_prompt(self, prompt_id: str) -> dict[str, Any] | None:
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """
                SELECT p.*, g.name AS group_name, w.name AS workflow_name, w.path AS workflow_path,
                       (SELECT COUNT(*) FROM prompt_media pm WHERE pm.prompt_id=p.id) AS media_count,
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
        fields_json = json.dumps(fields, ensure_ascii=False, separators=(",", ":"))
        fp = fingerprint_fields(fields)
        with self._lock, self._conn() as conn:
            conn.execute(
                """
                INSERT INTO prompts(id, workflow_id, group_id, name, fields_json, fingerprint, notes, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (prompt_id, workflow_id, group_id, cleaned, fields_json, fp, notes or "", now, now),
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
            updates.extend(["fields_json=?", "fingerprint=?"])
            params.extend([
                json.dumps(fields, ensure_ascii=False, separators=(",", ":")),
                fingerprint_fields(fields),
            ])
        if group_id is not ...:
            updates.append("group_id=?")
            params.append(group_id)
        if notes is not None:
            updates.append("notes=?")
            params.append(notes)
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

    def list_media(self, prompt_id: str) -> list[dict[str, Any]]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM prompt_media WHERE prompt_id=? ORDER BY id DESC",
                (prompt_id,),
            ).fetchall()
            return [dict(r) for r in rows]

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
