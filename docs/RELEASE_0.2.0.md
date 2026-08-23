# ComfyUI Prompt Bookmarks 0.2.0 release checklist

## Release candidate checks

- Confirm `pyproject.toml` version is `0.2.0`.
- Confirm CI passes on Python 3.10, 3.11 and 3.12.
- Upgrade an existing 0.1.x installation without deleting `prompt_bookmarks.db`.
- Save a bookmark by selecting an existing group from the group suggestions.
- Save a bookmark by typing a brand-new group name.
- Export JSON, then import it into a disposable ComfyUI user directory.
- Confirm importing the same backup twice does not duplicate media references.
- Verify image preview, video final-frame preview, stale-preview fallback and optional muted autoplay.
- Verify English and Simplified Chinese UI.

## Comfy Registry

The repository already includes `.github/workflows/publish-node.yml` using `Comfy-Org/publish-node-action@v1`.

Before publishing:

1. Confirm the Comfy Registry publisher ID matches `vdeng-ai` in `pyproject.toml`.
2. Create a Comfy Registry personal access token.
3. Add it to this repository as the Actions secret `REGISTRY_ACCESS_TOKEN`.
4. Run **Publish to Comfy Registry** manually from GitHub Actions.

The publish action reads the version from `pyproject.toml`. Keep the workflow manual so documentation-only changes cannot accidentally publish a new Registry version.

## GitHub Release

After the release candidate is tested:

1. Create tag `v0.2.0` from the tested `main` commit.
2. Create a GitHub Release titled `ComfyUI Prompt Bookmarks v0.2.0`.
3. Use the `0.2.0` section of `CHANGELOG.md` as the release notes.

## ComfyUI Manager

Registry publishing and the legacy Manager node database remain separate discovery paths. The prepared legacy submission entry is stored in `docs/COMFYUI_MANAGER_SUBMISSION.md`.
