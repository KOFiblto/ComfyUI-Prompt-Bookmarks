# ComfyUI Prompt Bookmarks development plan

## Product boundary

Prompt Bookmarks is a lightweight sidebar extension for saving and reusing prompt sets. It must not inject inference nodes into workflows and must not duplicate generated media.

The core object is a **prompt set**, not a single positive/negative string. Each workflow stores bindings to arbitrary text widgets, which makes the plugin usable with image and video workflows that expose different prompt fields.

## Phase 0 — Extension skeleton

Status: **implemented in 0.1.0**

- Export `WEB_DIRECTORY`
- Register a custom ComfyUI sidebar tab
- Add `/prompt-bookmarks/health`
- Initialize SQLite in the ComfyUI user directory
- Keep `NODE_CLASS_MAPPINGS` empty

Acceptance:

- ComfyUI boots without registering any nodes
- Prompt Bookmarks tab opens and closes normally
- Database is created outside `custom_nodes`

## Phase 1 — Workflow awareness

Status: **implemented in 0.1.0**

- Read current workflow UUID from `extensionManager.workflow.activeWorkflow.activeState.id`
- Track workflow name/path for display only
- Follow workflow tab changes without page reload
- Offer Current Workflow / All Workflows views

Acceptance:

- Switching workflows updates the vault automatically
- Renaming a workflow does not orphan prompts because UUID is the identity

## Phase 2 — Prompt field bindings

Status: **implemented in 0.1.0**

- Scan editable string widgets in the current graph
- Heuristically mark likely prompt fields
- Let the user confirm fields and edit labels
- Store `node_id + node_type + widget_name + label`
- Detect missing bindings when the graph changes

Acceptance:

- A workflow can bind multiple prompt fields
- Binding configuration survives ComfyUI restart
- Missing nodes/widgets do not cause silent writes to unrelated fields

## Phase 3 — Prompt library MVP

Status: **implemented in 0.1.0**

- Save current bound values
- Name and group entries
- Search
- Apply within the same workflow
- Copy from any workflow
- Edit metadata
- Delete entries
- Track use count and last used timestamp

Acceptance:

- Save A → change widgets → Apply A restores all available fields
- Prompts from another workflow remain copyable but cannot be accidentally applied

## Phase 4 — Generated media auto-link

Status: **implemented as best-effort in 0.1.0**

- Listen for `execution_success`
- Fetch `/history/{prompt_id}` with retry to avoid output-persistence races
- Extract values for the workflow's bindings from the submitted prompt graph
- Compute a stable SHA-256 fingerprint on the backend
- Find saved entries with the same workflow + fingerprint
- Record ComfyUI output references without copying files
- Show latest image/video in each prompt card

Acceptance:

- Generating with an unchanged saved prompt attaches output preview
- Manually changing a bound prompt field before execution prevents false association
- Removing the plugin does not remove generated output files

## Phase 5 — Trial hardening

Target: **0.1.x after real-world feedback**

- Validate MiniMax H3 workflows and popular video save nodes
- Validate Qwen Image / Flux workflows
- Improve media metadata extraction for custom video node output shapes
- Add explicit stale-preview state when source files are gone
- Better binding repair when node IDs change
- Add group rename/delete UI
- Add prompt field-content editing in the vault
- Add media history drawer and cover selection

## Phase 6 — Stable 0.2.0

Target after trial feedback:

- Export/import Prompt Bookmarks data
- Optional JSON backup
- Subgraph-aware binding IDs
- Sort modes (recent, name, most used)
- Duplicate/move prompt actions
- Preview autoplay setting and lazy media loading improvements
- Migration framework for future database schema versions

## Explicit non-goals for 0.1

- Cloud sync
- Prompt marketplace
- AI prompt rewriting
- LoRA/checkpoint/sampler recipe management
- Workflow snapshots
- Queue interception or monkey-patching `queuePrompt()`
- FFmpeg dependency
- Copying generated media into a second asset directory
