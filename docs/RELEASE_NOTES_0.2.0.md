# ComfyUI Prompt Bookmarks v0.2.0

This release keeps Prompt Bookmarks focused on lightweight personal prompt reuse while making the library safer to upgrade, easier to back up, and more comfortable to browse.

## Highlights

- Export and import portable JSON backups without copying generated media files.
- Automatic database migration from the 0.1.x schema.
- More resilient exposed-field bindings when node IDs change.
- Sort bookmarks by recent use, recent save time, name, or use count.
- Lazy video preview loading with optional muted autoplay.
- Save prompts into an existing group from suggestions, or type a new group name as before.
- Fixed-height image/video previews with last-frame video resting preview.
- Improved stale-media handling and automatic preview linking.

## Upgrade notes

Existing 0.1.x users can update normally. Do not delete `prompt_bookmarks.db`; the extension migrates the schema automatically.

Generated images and videos are still referenced in their original ComfyUI output locations and are not copied into the plugin database.

Cross-workflow reuse remains intentionally simple: use **Copy** to place the prompt text on the clipboard. Duplicate/Move actions are not part of 0.2.0.
