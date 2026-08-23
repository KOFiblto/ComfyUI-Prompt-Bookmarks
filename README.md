# ComfyUI Prompt Bookmarks

A lightweight, workflow-aware prompt library for ComfyUI. Prompt Bookmarks lives entirely in the **ComfyUI sidebar** and does not add inference nodes to your workflows.

## Features

- Sidebar-first UI; no extra workflow nodes
- **English and Simplified Chinese UI** with Auto / 中文 / English language selection
- Detects the active ComfyUI workflow by workflow UUID
- **Visual prompt-field picker**: select editable text fields with checkboxes; users never need to enter node IDs
- Automatically recommends likely prompt/text fields and filters common path/filename fields
- Shows current field content and provides a **Locate** button to jump to the corresponding node on the canvas
- Supports normal ComfyUI groups transparently and displays the group path in the picker
- Works with editable widgets exposed by group nodes/subgraphs; hidden internal subgraph fields are intentionally not modified in v0.1
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

Restart ComfyUI and refresh the browser. A **Prompt Bookmarks / 提示词收藏** bookmark icon should appear in the sidebar.

No additional Python package installation is required. The backend uses Python's built-in `sqlite3` module.

## First use

1. Open a workflow in ComfyUI.
2. Open **Prompt Bookmarks / 提示词收藏** from the sidebar.
3. Click **Choose Prompt Fields / 选择提示词字段**.
4. Prompt Bookmarks automatically scans editable string widgets and recommends likely prompt fields.
5. Tick the fields that should be saved/restored together. Use **Locate / 定位** to jump to a field's node on the canvas if needed.
6. Click **Save Current Prompt / 收藏当前提示词**.
7. Enter a bookmark name and an optional group.
8. Later, click **Apply / 应用** to restore all selected fields at once.

You never need to know or enter ComfyUI node IDs. Node IDs and widget names are stored internally only so Prompt Bookmarks can safely find the selected fields again.

## Groups, group nodes, and subgraphs

Prompt Bookmarks v0.1 intentionally follows a conservative compatibility rule:

- **Normal canvas groups**: fully transparent. The picker shows the group path, for example `Video Generation › Character Prompt › text`.
- **Group nodes / subgraphs with exposed text widgets**: supported through the text widgets visible and editable on the outer node.
- **Hidden internal subgraph widgets**: not modified directly in v0.1. Expose the desired prompt field on the outer node first.

This avoids storing fragile internal graph paths while ComfyUI's subgraph APIs continue to evolve.

## Language

Open the gear icon in the sidebar and choose:

- **Auto / 自动** — follows the current ComfyUI/browser language when possible
- **简体中文**
- **English**

The same language preference is also available in ComfyUI Settings as **Prompt Bookmarks: Language / 语言**.

## Automatic previews

When an execution completes, Prompt Bookmarks reads ComfyUI's `/history/{prompt_id}` result, reconstructs the saved selected fields, and matches them to saved prompt fingerprints. Matching output media are recorded as references in the Prompt Bookmarks database.

The history endpoint can briefly lag behind the `execution_success` event, so the frontend retries for a short period before giving up. This is intentionally non-blocking and does not affect generation.

Supported preview detection currently includes common image files plus MP4, WebM, MOV, MKV, and M4V video outputs when those outputs expose ComfyUI-style `{filename, subfolder, type}` metadata.

## Data location

The database is stored under the active ComfyUI user directory:

```text
<ComfyUI user directory>/prompt_bookmarks/prompt_bookmarks.db
```

Deleting or updating the custom node repository does not remove your saved prompts.

## Current limitations (0.1.x)

- Prompt field discovery currently operates on editable widgets visible to the active/root canvas. Hidden internal subgraph fields must be exposed first.
- Cross-workflow **Apply** is disabled by design. Cross-workflow **Copy** is supported.
- Prompt media are references to files in ComfyUI output storage; if those files are deleted, the preview becomes unavailable.
- If two saved entries in the same workflow have identical selected-field content, a matching execution can be associated with both entries.
- Automatic field detection is heuristic; the user always confirms selected fields before anything is stored.

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
