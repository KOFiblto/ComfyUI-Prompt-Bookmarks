import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "vdeng.PromptBookmarks.PreviewBehavior";
const STYLE_ID = "prompt-bookmarks-preview-styles";
const AUTOPLAY_SETTING = "PromptBookmarks.PreviewAutoplay";
let videoObserver = null;

function settingGet(id, fallback = null) {
  try { return app.extensionManager?.setting?.get?.(id) ?? fallback; } catch (_) { return fallback; }
}

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
  try { video.currentTime = Math.max(0, duration - 0.08); } catch (_) {}
}

function ensureVideoSource(video) {
  if (video.src || !video.dataset.pbSrc) return;
  video.preload = "metadata";
  video.src = video.dataset.pbSrc;
  video.load?.();
}

function syncVideoPlayback(video) {
  const autoplay = settingGet(AUTOPLAY_SETTING, false) === true;
  const visible = video.dataset.pbVisible === "1";
  video.loop = autoplay;
  if (autoplay && visible) {
    ensureVideoSource(video);
    video.play?.().catch?.(() => {});
  } else {
    video.pause?.();
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seekToLastFrame(video);
  }
}

function prepareVideo(video) {
  if (!(video instanceof HTMLVideoElement) || video.dataset.pbPreviewPrepared === "1") return;
  video.dataset.pbPreviewPrepared = "1";
  video.muted = true;
  video.playsInline = true;
  video.preload = video.dataset.pbSrc ? "none" : "metadata";

  video.addEventListener("loadedmetadata", () => syncVideoPlayback(video));
  video.addEventListener("play", () => {
    if (settingGet(AUTOPLAY_SETTING, false) === true) return;
    const duration = Number(video.duration);
    if (Number.isFinite(duration) && duration > 0 && video.currentTime >= duration - 0.2) video.currentTime = 0;
  });

  if (videoObserver) videoObserver.observe(video);
  else {
    video.dataset.pbVisible = "1";
    ensureVideoSource(video);
    syncVideoPlayback(video);
  }
}

function preparePreviewNode(node) {
  if (!(node instanceof Element)) return;
  if (node.matches("video.pb-media")) prepareVideo(node);
  node.querySelectorAll?.("video.pb-media").forEach(prepareVideo);
}

function refreshAutoplay() {
  document.querySelectorAll("video.pb-media").forEach((video) => {
    if (video instanceof HTMLVideoElement) syncVideoPlayback(video);
  });
}

app.registerExtension({
  name: EXTENSION_NAME,
  setup() {
    injectPreviewStyles();
    if (typeof IntersectionObserver !== "undefined") {
      videoObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const video = entry.target;
          if (!(video instanceof HTMLVideoElement)) continue;
          video.dataset.pbVisible = entry.isIntersecting ? "1" : "0";
          if (entry.isIntersecting) ensureVideoSource(video);
          syncVideoPlayback(video);
        }
      }, { rootMargin: "300px 0px", threshold: 0.01 });
    }

    document.querySelectorAll("video.pb-media").forEach(prepareVideo);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) preparePreviewNode(node);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("prompt-bookmarks-autoplay-changed", refreshAutoplay);
  },
});
