# Changelog

All notable changes to ComfyUI Prompt Bookmarks are documented here.

## 0.3.0 — 2026-08-25

### Added

- **Multi-Cover Carousel & Lightbox**: Attach and manage multiple cover images/videos per bookmark with add/remove buttons, inline preview strips, and an in-window lightbox viewer with `[❮]` / `[❯]` navigation.
- **Centered Resizable Modals**: Dialogs can be resized freely from the bottom-right corner while maintaining center alignment; prompt textareas stretch automatically to consume available vertical space.
- **Zero-Dependency Password Encryption**: Local AES-256-GCM encryption with PBKDF2 key derivation for prompt fields and notes using the Python standard library. Includes inline sidebar unlock banner, instant lock toggle, and media protection while locked.
- **Direct SQLite Database (.db) Backup & Restore**: One-click raw database download and restore with automatic `.db.bak` safety backups.
- **Manual Prompt Creation**: "Add Prompt" dialog for creating bookmarks with free-form text input without requiring active canvas fields.
- **Inline Prompt Editing**: "Edit" action on bookmark cards allowing instant updates to prompt fields, name, group, and private notes.
- **Select All & Clear All**: Quick selection actions in the field configuration dialog.
- **Third-Party Integration Event**: Dispatches and listens to `prompt-bookmarks-create` events for seamless external extension integration.
- **Arbitrary Widget Presets**: Optional "Show all widgets" toggle allowing bookmarks to capture LoRA, steps, and aspect ratio widgets alongside prompt text.

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
