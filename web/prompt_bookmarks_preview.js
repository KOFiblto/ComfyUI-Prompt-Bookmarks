import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "vdeng.PromptBookmarks.PreviewBehavior";
const STYLE_ID = "prompt-bookmarks-preview-styles";

function injectPreviewStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .pb-media {
      width: 100%;
      height: 160px !important;
      aspect-ratio: auto !important;
      display: block;
      object-fit: contain !important;
      background: #111;
    }
  `;
  document.head.appendChild(style);
}

function seekToLastFrame(video) {
  const duration = Number(video.duration);
  if (!Number.isFinite(duration) || duration <= 0) return;
  try {
    video.currentTime = Math.max(0, duration - 0.08);
  } catch (_) {}
}

function prepareVideo(video) {
  if (!(video instanceof HTMLVideoElement) || video.dataset.pbPreviewPrepared === "1") return;
  video.dataset.pbPreviewPrepared = "1";
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seekToLastFrame(video);
  else video.addEventListener("loadedmetadata", () => seekToLastFrame(video), { once: true });

  // A preview initially rests near the end. If the user presses Play,
  // restart from the beginning instead of immediately finishing playback.
  video.addEventListener("play", () => {
    const duration = Number(video.duration);
    if (Number.isFinite(duration) && duration > 0 && video.currentTime >= duration - 0.2) {
      video.currentTime = 0;
    }
  });
}

function preparePreviewNode(node) {
  if (!(node instanceof Element)) return;
  if (node.matches("video.pb-media")) prepareVideo(node);
  node.querySelectorAll?.("video.pb-media").forEach(prepareVideo);
}

app.registerExtension({
  name: EXTENSION_NAME,
  setup() {
    injectPreviewStyles();
    document.querySelectorAll("video.pb-media").forEach(prepareVideo);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) preparePreviewNode(node);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },
});
