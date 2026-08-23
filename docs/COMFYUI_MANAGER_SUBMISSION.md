# ComfyUI Manager submission

This repository is designed to be installable as a sidebar-only ComfyUI extension with no additional Python dependencies.

ComfyUI Manager is currently transitioning from its legacy node database to the official Comfy Registry. The repository already contains `pyproject.toml` metadata for the Registry. For the legacy/new-node database path, use the following entry in `node_db/new/custom-node-list.json` of `Comfy-Org/ComfyUI-Manager`:

```json
{
  "author": "vdeng-ai",
  "title": "ComfyUI Prompt Bookmarks",
  "reference": "https://github.com/vdeng-ai/ComfyUI-Prompt-Bookmarks",
  "files": [
    "https://github.com/vdeng-ai/ComfyUI-Prompt-Bookmarks"
  ],
  "install_type": "git-clone",
  "description": "Lightweight sidebar-only personal prompt organizer for ComfyUI. Bookmark, group, search, copy and restore prompts without adding workflow nodes or installing extra dependencies."
}
```

The extension intentionally exports no inference nodes. It registers a ComfyUI sidebar tab and backend HTTP routes, and stores user data under the ComfyUI user directory.

## Registry publishing

1. Create/confirm the publisher ID declared in `pyproject.toml`.
2. Create a Comfy Registry personal access token.
3. Add it to this repository as the GitHub Actions secret `REGISTRY_ACCESS_TOKEN`.
4. Run **Publish to Comfy Registry** from GitHub Actions.

The workflow is manual by design so ordinary documentation or metadata changes do not accidentally publish a new Registry version.
