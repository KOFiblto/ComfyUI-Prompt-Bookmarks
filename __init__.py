import logging

WEB_DIRECTORY = "./web"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

try:
    from .prompt_bookmarks.api import register_routes

    register_routes()
except Exception:
    logging.getLogger("comfyui_prompt_bookmarks").exception("Failed to initialize Prompt Bookmarks")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
