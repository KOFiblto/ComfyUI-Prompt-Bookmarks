# Changelog

All notable changes to ComfyUI Prompt Bookmarks are documented here.

## 0.2.0 — 2026-08-23

### Added

- Portable JSON export/import backup for workflows, bindings, groups, prompt sets, usage metadata and media references.
- Merge-style restore that updates matching bookmark IDs while keeping unrelated existing bookmarks.
- Lightweight schema migration framework with explicit schema versioning.
- Stable `binding_key` metadata for exposed prompt fields, while preserving conservative unique-match fallback behavior.
- Sorting by recently used, recently saved, name or use count.
- Lazy video preview loading and optional muted autoplay.
- Existing-group suggestions in the Save Current Prompt dialog while retaining free-form group entry.

### Improved

- Missing media now shows an explicit stale-preview state instead of a broken image/video element.
- Binding recovery is safer when node IDs change.
- Empty-group handling and group rename behavior were improved.
- Image/video previews use a fixed-height contain layout; videos use the final frame as the resting preview.
- Automatic preview linking supports virtual/frontend-only prompt fields through execution workflow snapshots.

### Compatibility

- Existing 0.1.x databases are migrated automatically; users do not need to delete or recreate `prompt_bookmarks.db`.
- Existing 0.1.x prompt fingerprints remain compatible after `binding_key` is introduced.
- Cross-workflow reuse remains Copy to clipboard only. Duplicate and Move actions are intentionally not included.

## 0.1.x

Initial public release series with the sidebar prompt library, workflow-aware field bindings, bilingual UI, groups, search, Apply/Copy/Delete, SQLite persistence and automatic generated-media preview linking.
