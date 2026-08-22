# ComfyUI Prompt Bookmarks

A lightweight, workflow-aware prompt library for ComfyUI. Prompt Bookmarks lives entirely in the **ComfyUI sidebar** and does not add inference nodes to your workflows.

## Features

- Sidebar-first UI; no extra workflow nodes
- Detects the active ComfyUI workflow by workflow UUID
- Bind any string/text widget as part of a prompt set
- Save multiple fields together (for example main prompt + motion prompt + negative prompt)
- Organize prompts by workflow and group
- Search saved prompts
- One-click apply to the current workflow
- Copy prompts from any workflow to the clipboard
- SQLite persistence under the ComfyUI user directory
- Best-effort automatic image/video preview linking after successful executions
- Media references point to existing ComfyUI outputs; Prompt Bookmarks does **not** duplicate generated files

## Installation

```bash
cd /path/to/ComfyUI/custom_nodes
git clone https://github.com/vdeng-ai/ComfyUI-Prompt-Bookmarks.git
```

Restart ComfyUI and refresh the browser. A **Prompt Bookmarks** bookmark icon should appear in the sidebar.

No additional Python package installation is required. The backend uses Python's built-in `sqlite3` module.

## First use

1. Open a workflow in ComfyUI.
2. Open **Prompt Bookmarks** from the sidebar.
3. Click the gear icon.
4. Select the text widgets that make up a prompt set and give them readable labels.
5. Click **Save current prompt**.
6. Give the prompt a name and optional group.
7. Later, click **Apply** to restore all bound fields at once.

Prompt Bookmarks intentionally stores field bindings per workflow. This lets it support CLIP Text Encode, H3/Wan/Qwen custom prompt widgets, multiline text nodes, and other string-based nodes without hard-coding node classes.

## Automatic previews

When an execution completes, Prompt Bookmarks reads ComfyUI's `/history/{prompt_id}` result, reconstructs the saved bound fields, and matches them to saved prompt fingerprints. Matching output media are recorded as references in the Prompt Bookmarks database.

The history endpoint can briefly lag behind the `execution_success` event, so the frontend retries for a short period before giving up. This is intentionally non-blocking and does not affect generation.

Supported preview detection currently includes common image files plus MP4, WebM, MOV, MKV, and M4V video outputs when those outputs expose ComfyUI-style `{filename, subfolder, type}` metadata.

## Data location

The database is stored under the active ComfyUI user directory:

```text
<ComfyUI user directory>/prompt_bookmarks/prompt_bookmarks.db
```

Deleting or updating the custom node repository does not remove your saved prompts.

## Current limitations (0.1.0)

- Root-graph widgets are supported; explicit subgraph binding UX is not implemented yet.
- Cross-workflow **Apply** is disabled by design. Cross-workflow **Copy** is supported.
- Prompt media are references to files in ComfyUI output storage; if those files are deleted, the preview becomes unavailable.
- If two saved entries in the same workflow have identical bound-field content, a matching execution can be associated with both entries.
- Automatic field detection is heuristic; the user confirms bindings before anything is stored.

## Development

Run the dependency-free backend unit tests:

```bash
python -m unittest discover -s tests -v
```

Check frontend syntax:

```bash
node --check web/prompt_bookmarks.js
```

See [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) for the implementation roadmap.

## License

MIT
