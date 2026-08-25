from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from aiohttp import web
import folder_paths
from server import PromptServer

from .database import PromptBookmarksDB

LOGGER = logging.getLogger("comfyui_prompt_bookmarks")
_DB: PromptBookmarksDB | None = None
_ROUTES_REGISTERED = False


def get_db_path() -> Path:
    return Path(folder_paths.get_user_directory()) / "prompt_bookmarks" / "prompt_bookmarks.db"


def get_db() -> PromptBookmarksDB:
    global _DB
    if _DB is None:
        _DB = PromptBookmarksDB(get_db_path())
    return _DB


async def _json(request: web.Request) -> dict[str, Any]:
    try:
        data = await request.json()
    except Exception as exc:
        raise web.HTTPBadRequest(text="Invalid JSON body") from exc
    if not isinstance(data, dict):
        raise web.HTTPBadRequest(text="JSON body must be an object")
    return data


def _ok(data: Any = None, **extra: Any) -> web.Response:
    payload: dict[str, Any] = {"ok": True}
    if data is not None:
        payload["data"] = data
    payload.update(extra)
    return web.json_response(payload)


def _error(message: str, status: int = 400) -> web.Response:
    return web.json_response({"ok": False, "error": message}, status=status)


def _require_text(data: dict[str, Any], key: str) -> str:
    value = str(data.get(key, "")).strip()
    if not value:
        raise ValueError(f"{key} is required")
    return value


def register_routes() -> None:
    global _ROUTES_REGISTERED
    if _ROUTES_REGISTERED:
        return
    _ROUTES_REGISTERED = True
    routes = PromptServer.instance.routes

    @routes.get("/prompt-bookmarks/health")
    async def health(_request: web.Request) -> web.Response:
        db = get_db()
        return _ok({"version": "0.2.0", "schema_version": db.schema_version(), "database": str(db.path)})

    @routes.get("/prompt-bookmarks/backup")
    async def backup_get(_request: web.Request) -> web.Response:
        return _ok(get_db().export_backup())

    @routes.post("/prompt-bookmarks/backup/import")
    async def backup_import(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            return _ok(get_db().import_backup(data))
        except ValueError as exc:
            return _error(str(exc))
        except Exception:
            LOGGER.exception("Failed to import Prompt Bookmarks backup")
            return _error("Failed to import backup", 500)

    @routes.get("/prompt-bookmarks/workflows")
    async def workflows_get(_request: web.Request) -> web.Response:
        return _ok(get_db().list_workflows())

    @routes.post("/prompt-bookmarks/workflows")
    async def workflows_post(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            workflow_id = _require_text(data, "workflow_id")
            item = get_db().upsert_workflow(
                workflow_id,
                str(data.get("name", "")),
                str(data.get("path", "")),
            )
            return _ok(item)
        except ValueError as exc:
            return _error(str(exc))

    @routes.get("/prompt-bookmarks/bindings")
    async def bindings_get(request: web.Request) -> web.Response:
        workflow_id = request.query.get("workflow_id", "").strip()
        if not workflow_id:
            return _error("workflow_id is required")
        return _ok(get_db().get_bindings(workflow_id))

    @routes.put("/prompt-bookmarks/bindings")
    async def bindings_put(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            workflow_id = _require_text(data, "workflow_id")
            bindings = data.get("bindings", [])
            if not isinstance(bindings, list):
                return _error("bindings must be an array")
            return _ok(get_db().replace_bindings(workflow_id, bindings))
        except ValueError as exc:
            return _error(str(exc))

    @routes.get("/prompt-bookmarks/groups")
    async def groups_get(request: web.Request) -> web.Response:
        workflow_id = request.query.get("workflow_id", "").strip()
        if not workflow_id:
            return _error("workflow_id is required")
        return _ok(get_db().list_groups(workflow_id))

    @routes.post("/prompt-bookmarks/groups")
    async def groups_post(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            workflow_id = _require_text(data, "workflow_id")
            return _ok(get_db().create_group(workflow_id, _require_text(data, "name")))
        except ValueError as exc:
            return _error(str(exc))
        except Exception:
            LOGGER.exception("Failed to create group")
            return _error("Failed to create group", 500)

    @routes.put("/prompt-bookmarks/groups/{group_id}")
    async def groups_put(request: web.Request) -> web.Response:
        try:
            group_id = int(request.match_info["group_id"])
            data = await _json(request)
            item = get_db().update_group(group_id, _require_text(data, "name"))
            return _ok(item)
        except ValueError as exc:
            return _error(str(exc))
        except Exception:
            LOGGER.exception("Failed to update group")
            return _error("Failed to update group", 500)

    @routes.delete("/prompt-bookmarks/groups/{group_id}")
    async def groups_delete(request: web.Request) -> web.Response:
        try:
            group_id = int(request.match_info["group_id"])
            return _ok({"deleted": get_db().delete_group(group_id)})
        except ValueError:
            return _error("Invalid group id")

    @routes.get("/prompt-bookmarks/prompts")
    async def prompts_get(request: web.Request) -> web.Response:
        workflow_id = request.query.get("workflow_id") or None
        group_raw = request.query.get("group_id")
        try:
            group_id = int(group_raw) if group_raw not in (None, "") else None
            limit = int(request.query.get("limit", "300"))
        except ValueError:
            return _error("Invalid group_id or limit")
        return _ok(
            get_db().list_prompts(
                workflow_id=workflow_id,
                group_id=group_id,
                query=request.query.get("q", ""),
                limit=limit,
                sort=request.query.get("sort", "recent"),
            )
        )

    @routes.post("/prompt-bookmarks/prompts")
    async def prompts_post(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            workflow_id = _require_text(data, "workflow_id")
            fields = data.get("fields", [])
            if not isinstance(fields, list):
                return _error("fields must be an array")
            group_id = data.get("group_id")
            if group_id in ("", None):
                group_id = None
            elif not isinstance(group_id, int):
                group_id = int(group_id)
            item = get_db().create_prompt(
                workflow_id=workflow_id,
                name=_require_text(data, "name"),
                fields=fields,
                group_id=group_id,
                notes=str(data.get("notes", "")),
            )
            return _ok(item)
        except ValueError as exc:
            return _error(str(exc))
        except Exception:
            LOGGER.exception("Failed to create prompt")
            return _error("Failed to create prompt", 500)

    @routes.put("/prompt-bookmarks/prompts/{prompt_id}")
    async def prompts_put(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            kwargs: dict[str, Any] = {}
            for key in ("name", "fields", "notes"):
                if key in data:
                    kwargs[key] = data[key]
            if "group_id" in data:
                value = data["group_id"]
                kwargs["group_id"] = None if value in (None, "") else int(value)
            item = get_db().update_prompt(request.match_info["prompt_id"], **kwargs)
            if item is None:
                return _error("Prompt not found", 404)
            return _ok(item)
        except ValueError as exc:
            return _error(str(exc))
        except Exception:
            LOGGER.exception("Failed to update prompt")
            return _error("Failed to update prompt", 500)

    @routes.delete("/prompt-bookmarks/prompts/{prompt_id}")
    async def prompts_delete(request: web.Request) -> web.Response:
        return _ok({"deleted": get_db().delete_prompt(request.match_info["prompt_id"])})

    @routes.post("/prompt-bookmarks/prompts/{prompt_id}/used")
    async def prompts_used(request: web.Request) -> web.Response:
        get_db().mark_used(request.match_info["prompt_id"])
        return _ok()

    @routes.get("/prompt-bookmarks/prompts/{prompt_id}/media")
    async def prompt_media_get(request: web.Request) -> web.Response:
        return _ok(get_db().list_media(request.match_info["prompt_id"]))

    @routes.post("/prompt-bookmarks/prompts/{prompt_id}/media")
    async def prompt_media_post(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            prompt_id = request.match_info["prompt_id"]
            filename = _require_text(data, "filename")
            subfolder = str(data.get("subfolder", ""))
            media_type = str(data.get("media_type", "image"))
            storage_type = str(data.get("type", "input"))
            success = get_db().link_media_to_prompt(prompt_id, filename, subfolder, media_type, storage_type)
            return _ok({"success": success})
        except ValueError as exc:
            return _error(str(exc))
        except Exception:
            LOGGER.exception("Failed to link media")
            return _error("Failed to link media", 500)

    @routes.post("/prompt-bookmarks/media/link")
    async def media_link(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            workflow_id = _require_text(data, "workflow_id")
            fields = data.get("fields", [])
            media = data.get("media", [])
            if not isinstance(fields, list) or not isinstance(media, list):
                return _error("fields and media must be arrays")
            prompt_ids = get_db().link_media_by_fields(
                workflow_id=workflow_id,
                fields=fields,
                execution_id=str(data.get("execution_id", "")),
                media=media,
            )
            return _ok({"linked_prompt_ids": prompt_ids})
        except ValueError as exc:
            return _error(str(exc))
        except Exception:
            LOGGER.exception("Failed to link media")
            return _error("Failed to link media", 500)

    @routes.get("/prompt-bookmarks/encryption/status")
    async def encryption_status(request: web.Request) -> web.Response:
        return _ok(get_db().get_encryption_status())

    @routes.post("/prompt-bookmarks/encryption/unlock")
    async def encryption_unlock(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            password = str(data.get("password", ""))
            unlocked = get_db().unlock_session(password)
            if not unlocked:
                return _error("Incorrect password", 401)
            return _ok({"unlocked": True})
        except Exception as exc:
            return _error(str(exc))

    @routes.post("/prompt-bookmarks/encryption/lock")
    async def encryption_lock(request: web.Request) -> web.Response:
        get_db().lock_session()
        return _ok({"unlocked": False})

    @routes.post("/prompt-bookmarks/encryption/enable")
    async def encryption_enable(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            password = str(data.get("password", ""))
            algorithm = str(data.get("algorithm", "AES-256-GCM"))
            res = get_db().enable_encryption(password, algorithm)
            return _ok(res)
        except Exception as exc:
            return _error(str(exc))

    @routes.post("/prompt-bookmarks/encryption/disable")
    async def encryption_disable(request: web.Request) -> web.Response:
        try:
            data = await _json(request)
            password = str(data.get("password", ""))
            res = get_db().disable_encryption(password)
            return _ok(res)
        except Exception as exc:
            return _error(str(exc))

    @routes.get("/prompt-bookmarks/db/file")
    async def db_file_download(request: web.Request) -> web.Response:
        db_path = get_db_path()
        if not db_path.exists():
            return _error("Database file not found", 404)
        return web.FileResponse(
            db_path,
            headers={"Content-Disposition": 'attachment; filename="prompt_bookmarks.db"'}
        )

    @routes.post("/prompt-bookmarks/db/file")
    async def db_file_upload(request: web.Request) -> web.Response:
        try:
            reader = await request.multipart()
            field = await reader.next()
            if not field:
                return _error("No file uploaded")
            db_path = get_db_path()
            db_path.parent.mkdir(parents=True, exist_ok=True)
            # Create backup of current DB before replacing
            if db_path.exists():
                bak_path = db_path.with_suffix(".db.bak")
                import shutil
                shutil.copy2(db_path, bak_path)
            with open(db_path, "wb") as f:
                while True:
                    chunk = await field.read_chunk()
                    if not chunk:
                        break
                    f.write(chunk)
            global _DB
            _DB = None  # Reload DB instance
            return _ok({"status": "ok", "message": "Database successfully restored"})
        except Exception as exc:
            LOGGER.exception("Failed to restore database file")
            return _error(f"Failed to restore database file: {exc}", 500)
