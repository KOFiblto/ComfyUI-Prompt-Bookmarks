import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "vdeng.PromptBookmarks.AssetOverlay";
const OVERLAY_SETTING = "PromptBookmarks.EnableAssetOverlayButton";

function isOverlayEnabled() {
  try {
    const val = app.extensionManager?.setting?.get?.(OVERLAY_SETTING);
    if (val === false || val === "false") return false;
    return true;
  } catch (_) {
    return true;
  }
}

const BOOKMARK_SVG = `<svg class="size-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`;
const BOOKMARK_SUCCESS_SVG = `<svg class="size-4 text-emerald-600 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const BOOKMARK_FAIL_SVG = `<svg class="size-4 text-rose-600 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * Client-side binary PNG chunk parser to extract prompt/parameters directly from ArrayBuffer.
 */
async function extractPromptFromImageUrl(imgSrc) {
  try {
    const resp = await fetch(imgSrc);
    if (!resp.ok) return null;
    const arrayBuffer = await resp.arrayBuffer();
    const dataView = new DataView(arrayBuffer);

    // Verify PNG magic header: 0x89504E47 0x0D0A1A0A
    if (dataView.byteLength < 16) return null;
    if (dataView.getUint32(0) !== 0x89504E47 || dataView.getUint32(4) !== 0x0D0A1A0A) {
      return null;
    }

    let offset = 8;
    const textDecoder = new TextDecoder("utf-8");
    const metadata = {};

    while (offset < dataView.byteLength - 8) {
      const length = dataView.getUint32(offset);
      const type = String.fromCharCode(
        dataView.getUint8(offset + 4),
        dataView.getUint8(offset + 5),
        dataView.getUint8(offset + 6),
        dataView.getUint8(offset + 7)
      );

      if (type === "tEXt" || type === "iTXt") {
        const chunkData = new Uint8Array(arrayBuffer, offset + 8, length);
        let nullIndex = 0;
        while (nullIndex < chunkData.length && chunkData[nullIndex] !== 0) nullIndex++;
        const keyword = textDecoder.decode(chunkData.subarray(0, nullIndex));

        let textValue = "";
        if (type === "tEXt") {
          textValue = textDecoder.decode(chunkData.subarray(nullIndex + 1));
        } else if (type === "iTXt") {
          const compFlag = chunkData[nullIndex + 1];
          let textStart = nullIndex + 3;
          while (textStart < chunkData.length && chunkData[textStart] !== 0) textStart++;
          textStart++;
          while (textStart < chunkData.length && chunkData[textStart] !== 0) textStart++;
          textStart++;
          if (compFlag === 0) {
            textValue = textDecoder.decode(chunkData.subarray(textStart));
          }
        }
        if (keyword && textValue) {
          metadata[keyword.toLowerCase()] = textValue;
        }
      }
      offset += 12 + length;
    }

    // 1. Check A1111 / WebUI / Forge / Civitai parameters
    if (metadata["parameters"]) {
      const lines = metadata["parameters"].split("\n");
      const pos = [];
      for (const line of lines) {
        if (line.trim().startsWith("Negative prompt:") || line.trim().startsWith("Steps:")) break;
        pos.push(line);
      }
      const res = pos.join("\n").trim();
      if (res) return res;
    }

    // 2. Check native ComfyUI prompt graph JSON
    if (metadata["prompt"]) {
      try {
        const promptData = JSON.parse(metadata["prompt"]);
        if (typeof promptData === "object" && promptData !== null) {
          const startNodes = [];
          for (const [nid, ndata] of Object.entries(promptData)) {
            const ctype = ndata?.class_type || "";
            const inputs = ndata?.inputs || {};
            if (ctype.includes("Sampler") || ctype.includes("KSampler") || ctype.includes("Guider") || ctype.includes("CFG")) {
              for (const linkKey of ["positive", "conditioning", "guider"]) {
                const link = inputs[linkKey];
                if (Array.isArray(link) && link.length > 0) {
                  startNodes.push(String(link[0]));
                }
              }
            }
          }

          const visited = new Set();
          const texts = [];

          function walk(nid) {
            if (!nid || visited.has(nid)) return;
            visited.add(nid);
            const ndata = promptData[nid];
            if (!ndata || typeof ndata !== "object") return;
            const inputs = ndata.inputs || {};

            for (const tkey of ["text", "prompt", "text_g", "text_l", "text_positive", "positive_prompt", "value", "string"]) {
              const val = inputs[tkey];
              if (typeof val === "string" && val.trim()) {
                const s = val.trim();
                if (!texts.includes(s)) texts.push(s);
              } else if (Array.isArray(val) && val.length > 0) {
                walk(String(val[0]));
              }
            }

            for (const [inName, inVal] of Object.entries(inputs)) {
              if (Array.isArray(inVal) && inVal.length > 0) {
                const low = inName.toLowerCase();
                if (low.includes("negative")) continue;
                if (["conditioning", "positive", "cond", "text", "prompt", "guider"].some((k) => low.includes(k))) {
                  walk(String(inVal[0]));
                }
              }
            }
          }

          for (const sn of startNodes) {
            walk(sn);
          }

          if (texts.length) return texts.join("\n");

          // Fallback: search all text / prompt nodes
          for (const [nid, ndata] of Object.entries(promptData)) {
            const ctype = ndata?.class_type || "";
            const inputs = ndata?.inputs || {};
            if (ctype.includes("CLIPTextEncode") || ctype.includes("Text") || ctype.includes("Prompt")) {
              for (const tkey of ["text", "prompt", "text_g", "text_l"]) {
                const t = inputs[tkey];
                if (typeof t === "string" && t.trim().length > 1) {
                  const s = t.trim();
                  if (!texts.includes(s)) texts.push(s);
                }
              }
            }
          }
          if (texts.length) return texts.join("\n");
        }
      } catch (_) {}
    }
  } catch (e) {
    console.debug("[Prompt Bookmarks] PNG metadata extraction failed:", e);
  }
  return null;
}

/**
 * Extracts prompt text and file metadata from image element or URL.
 */
async function getImagePromptAndMeta(imgSrc) {
  if (!imgSrc) return null;
  let url;
  try {
    url = new URL(imgSrc, window.location.origin);
  } catch (_) {
    return null;
  }

  let filename = url.searchParams.get("filename");
  let type = url.searchParams.get("type") || "output";
  let subfolder = url.searchParams.get("subfolder") || "";

  if (!filename) {
    const parts = url.pathname.split("/");
    filename = decodeURIComponent(parts[parts.length - 1]);
  }

  let promptText = null;
  try {
    promptText = await extractPromptFromImageUrl(imgSrc);
  } catch (_) {}

  return {
    promptText: promptText || "",
    filename: filename || "image",
    subfolder: subfolder || "",
    type: type || "output",
  };
}

/**
 * Triggers the PromptBookmarks save dialog with extracted prompt & media info.
 */
async function saveImageToPromptBookmarks(imgSrc) {
  const meta = await getImagePromptAndMeta(imgSrc);
  if (!meta) return false;

  const event = new CustomEvent("prompt-bookmarks-create", {
    detail: {
      name: meta.filename.replace(/\.[^/.]+$/, ""),
      text: meta.promptText,
      media: [
        {
          filename: meta.filename,
          subfolder: meta.subfolder,
          type: meta.type,
          media_type: "image",
        },
      ],
    },
  });
  window.dispatchEvent(event);
  return true;
}

function updateButtonGroupBorders(container) {
  if (!container) return;
  const buttons = Array.from(container.children).filter((el) => el.tagName === "BUTTON");
  if (buttons.length === 0) return;
  if (buttons.length === 1) {
    buttons[0].classList.remove("rounded-l-lg", "rounded-r-lg", "rounded-none", "rounded-l-none", "rounded-r-none", "border-r");
    buttons[0].classList.add("rounded-lg");
    return;
  }
  buttons.forEach((btn, index) => {
    btn.classList.remove("rounded-lg", "rounded-l-lg", "rounded-r-lg", "rounded-none", "rounded-l-none", "rounded-r-none", "border-r");
    if (index === 0) {
      btn.classList.add("rounded-l-lg", "rounded-r-none", "border-r");
    } else if (index === buttons.length - 1) {
      btn.classList.add("rounded-r-lg", "rounded-l-none");
    } else {
      btn.classList.add("rounded-none", "border-r");
    }
  });
}

function isQueueItemElement(el) {
  if (!el || typeof el.closest !== "function") return false;
  return !!el.closest("[data-job-id], .comfy-queue-item, .queue-item, .queue-list-item, .queue-entry");
}

let lastInteractedAssetCard = null;

function registerAssetInteraction(target) {
  if (!target) return;
  const card = target.closest?.(
    "div[data-virtual-grid-item], [data-asset-id], .asset-card, [data-testid='asset-card'], [data-node-id], .lg-node, .comfy-image-preview, .group"
  );
  if (card && !isQueueItemElement(card)) {
    lastInteractedAssetCard = card;
  }
}

document.addEventListener("pointerdown", (e) => registerAssetInteraction(e.target), true);
document.addEventListener("click", (e) => registerAssetInteraction(e.target), true);
document.addEventListener("contextmenu", (e) => registerAssetInteraction(e.target), true);

function getActiveImageSrc() {
  if (lastInteractedAssetCard) {
    const img = lastInteractedAssetCard.querySelector("img");
    if (img && img.src) return img.src;
  }
  const selected = document.querySelector(
    'div[data-virtual-grid-item] [data-selected="true"], [data-asset-id][data-selected="true"], .group[data-selected="true"]'
  );
  if (selected) {
    const img = selected.querySelector("img");
    if (img && img.src) return img.src;
  }
  const hovered = document.querySelector("div[data-virtual-grid-item]:hover, .asset-card:hover, .group:hover");
  if (hovered) {
    const img = hovered.querySelector("img");
    if (img && img.src) return img.src;
  }
  return null;
}

/**
 * Injects the "Save to Prompt Bookmarks" button directly onto asset cards next to the download button.
 */
function injectBookmarkButtonNextToDownload(downloadBtn) {
  if (!downloadBtn || !downloadBtn.parentElement) return;
  if (isQueueItemElement(downloadBtn)) return;

  const card = downloadBtn.closest(
    "div[data-virtual-grid-item], [data-asset-id], .asset-card, [data-testid='asset-card'], [data-node-id], .lg-node, .comfy-image-preview, .group"
  );
  if (!card) return;
  if (isQueueItemElement(card)) return;

  const img = card.querySelector("img");
  if (!img || !img.src) return;
  if (img.classList.contains("size-8") || img.closest(".size-8, .size-10, .h-12")) return;

  const parent = downloadBtn.parentElement;
  let bookmarkBtn = parent.querySelector(".pb-hover-bookmark");

  if (!isOverlayEnabled()) {
    if (bookmarkBtn) bookmarkBtn.remove();
    return;
  }

  if (bookmarkBtn) return;

  let baseClasses = downloadBtn.className
    .replace(/\brounded-[a-z0-9-]+\b/g, "")
    .replace(/\brounded\b/g, "")
    .replace(/\bborder-r\b/g, "")
    .replace(/\bborder-modal-card-badge-border\b/g, "")
    .trim();

  if (!baseClasses || baseClasses.length < 5) {
    baseClasses = "inline-flex items-center justify-center font-medium font-inter transition-colors focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 border border-transparent shadow-xs cursor-pointer bg-modal-card-badge-background text-modal-card-badge-foreground hover:bg-modal-card-badge-background-hover size-8 p-0";
  }

  bookmarkBtn = document.createElement("button");
  bookmarkBtn.type = "button";
  bookmarkBtn.title = "Save to Prompt Bookmarks";
  bookmarkBtn.setAttribute("aria-label", "Save to Prompt Bookmarks");
  bookmarkBtn.className = `pb-hover-bookmark ${baseClasses} shrink-0`;
  bookmarkBtn.innerHTML = BOOKMARK_SVG;

  bookmarkBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const activeImg = card.querySelector("img") || img;
    const success = await saveImageToPromptBookmarks(activeImg.src);
    bookmarkBtn.innerHTML = success ? BOOKMARK_SUCCESS_SVG : BOOKMARK_FAIL_SVG;
    setTimeout(() => {
      bookmarkBtn.innerHTML = BOOKMARK_SVG;
    }, 2000);
  };

  // Find the right sibling to insert after (either copy prompt button or download button)
  const copyBtn = parent.querySelector(".leafflow-hover-copy");
  const insertRef = copyBtn || downloadBtn;
  parent.insertBefore(bookmarkBtn, insertRef.nextSibling);
  updateButtonGroupBorders(parent);
}

/**
 * Injects "Save to prompt bookmarks" item into PrimeVue context menu in Assets pane.
 */
function injectContextMenuBookmark(contextMenu) {
  if (!contextMenu) return;
  if (contextMenu.querySelector(".pb-contextmenu-bookmark")) return;
  if (!isOverlayEnabled()) return;

  // Guard: strictly ignore top menu, menubar, command menus, and main application menus!
  if (
    contextMenu.closest?.(".comfy-command-menu, .comfy-menu, .p-menubar, [data-pc-name='menubar'], [data-pc-name='tieredmenu']") ||
    contextMenu.classList?.contains("comfy-command-menu") ||
    contextMenu.classList?.contains("p-tieredmenu") ||
    contextMenu.querySelector?.(".p-menubar-root-list, .p-tieredmenu-root-list, li[aria-label='File'], li[aria-label='New'], li[aria-label='Edit'], li[aria-label='View']")
  ) {
    return;
  }

  let downloadLi = null;
  const candidates = contextMenu.querySelectorAll('li[role="menuitem"], [data-pc-section="item"]');
  for (const item of candidates) {
    const label = (item.getAttribute("aria-label") || "").trim().toLowerCase();
    const text = (item.textContent || "").trim().toLowerCase();

    // Strictly ignore workflow export / save actions
    if (label.includes("export") || text.includes("export") || label.includes("save as") || text.includes("save as")) {
      continue;
    }

    if (label === "download" || label === "download image" || text === "download" || text === "download image") {
      downloadLi = item;
      break;
    }

    if (!downloadLi && (label.includes("download") || text.includes("download"))) {
      downloadLi = item;
    }
  }
  if (!downloadLi || !downloadLi.parentElement) return;

  const refBtn = downloadLi.querySelector("button");
  const btnClass = refBtn
    ? refBtn.className
    : "relative inline-flex items-center gap-2 cursor-pointer touch-manipulation whitespace-nowrap appearance-none border-none font-medium font-inter transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-secondary-foreground bg-secondary-background hover:bg-secondary-background-hover h-8 rounded-lg p-2 text-xs w-full justify-start p-contextmenu-item-link";

  const bookmarkLi = document.createElement("li");
  bookmarkLi.className = "p-contextmenu-item pb-contextmenu-bookmark";
  bookmarkLi.setAttribute("role", "menuitem");
  bookmarkLi.setAttribute("aria-label", "Save to prompt bookmarks");
  bookmarkLi.setAttribute("data-pc-section", "item");
  bookmarkLi.setAttribute("data-p-active", "false");
  bookmarkLi.setAttribute("data-p-focused", "false");

  bookmarkLi.innerHTML = `
<div class="p-contextmenu-item-content" data-pc-section="itemcontent">
  <button class="${btnClass}" tabindex="-1" data-pc-section="itemlink">
    ${BOOKMARK_SVG}
    <span>Save to prompt bookmarks</span>
  </button>
</div>
`;

  bookmarkLi.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const span = bookmarkLi.querySelector("span");
    const src = getActiveImageSrc();
    if (src) {
      const success = await saveImageToPromptBookmarks(src);
      if (span) span.textContent = success ? "Bookmarked! ✅" : "Failed ❌";
    }
    setTimeout(() => {
      contextMenu.style.display = "none";
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    }, 500);
  });

  const copyLi = contextMenu.querySelector(".leafflow-contextmenu-copy");
  const insertRef = copyLi || downloadLi;
  downloadLi.parentElement.insertBefore(bookmarkLi, insertRef.nextSibling);
}

function scanAndInject() {
  if (!isOverlayEnabled()) return;

  const downloadBtns = document.querySelectorAll(
    'button[aria-label="Download"], button[aria-label*="ownload" i], button[title*="Download" i]'
  );
  downloadBtns.forEach(injectBookmarkButtonNextToDownload);

  const menus = document.querySelectorAll(
    '.p-contextmenu, [data-pc-name="contextmenu"]'
  );
  menus.forEach(injectContextMenuBookmark);
}

// Delegated hover & pointerover listener for instant dynamic injection during virtual scrolling
document.addEventListener("pointerover", (e) => {
  const btn = e.target.closest?.('button[aria-label="Download"], button[aria-label*="ownload" i], button[title*="Download" i]');
  if (btn) {
    injectBookmarkButtonNextToDownload(btn);
    return;
  }
  const card = e.target.closest?.('div[data-virtual-grid-item], [data-asset-id], .asset-card, .group');
  if (card) {
    registerAssetInteraction(card);
    const cardDl = card.querySelector('button[aria-label="Download"], button[aria-label*="ownload" i], button[title*="Download" i]');
    if (cardDl) injectBookmarkButtonNextToDownload(cardDl);
  }
  const menu = e.target.closest?.('.p-contextmenu, [data-pc-name="contextmenu"]');
  if (menu) {
    injectContextMenuBookmark(menu);
  }
}, { passive: true });

document.addEventListener("mouseover", (e) => {
  const card = e.target.closest?.('div[data-virtual-grid-item], [data-asset-id], .asset-card, .group');
  if (card) {
    registerAssetInteraction(card);
    const cardDl = card.querySelector('button[aria-label="Download"], button[aria-label*="ownload" i], button[title*="Download" i]');
    if (cardDl) injectBookmarkButtonNextToDownload(cardDl);
  }
}, { passive: true });

// MutationObserver for DOM changes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "childList") {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (isQueueItemElement(node)) continue;

          if (node.matches?.('button[aria-label="Download"], button[aria-label*="ownload" i]')) {
            injectBookmarkButtonNextToDownload(node);
          } else if (node.matches?.('.p-contextmenu, [data-pc-name="contextmenu"]')) {
            injectContextMenuBookmark(node);
          } else if (node.querySelectorAll) {
            const dlBtns = node.querySelectorAll('button[aria-label="Download"], button[aria-label*="ownload" i]');
            dlBtns.forEach(injectBookmarkButtonNextToDownload);

            const ctxMenus = node.querySelectorAll('.p-contextmenu, [data-pc-name="contextmenu"]');
            ctxMenus.forEach(injectContextMenuBookmark);
          }
        }
      }
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// Periodic sweep every 500ms
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scanAndInject);
} else {
  scanAndInject();
}
setInterval(scanAndInject, 500);

app.registerExtension({
  name: EXTENSION_NAME,
  settings: [
    {
      id: OVERLAY_SETTING,
      name: "Show 'Save to Prompt Bookmarks' button on image cards",
      type: "boolean",
      defaultValue: true,
      onChange: () => scanAndInject(),
    },
  ],
  async beforeRegisterNodeDef(nodeType) {
    const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
    nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
      if (origGetExtraMenuOptions) {
        origGetExtraMenuOptions.apply(this, arguments);
      }
      if (!isOverlayEnabled()) return;
      const imgs = this.imgs;
      if (imgs && imgs.length > 0) {
        options.push({
          content: "🔖 Save to Prompt Bookmarks",
          callback: async () => {
            const img = imgs[this.imageIndex || 0];
            const src = typeof img === "string" ? img : img?.src || img?.value;
            if (!src) return;
            await saveImageToPromptBookmarks(src);
          },
        });
      }
    };
  },
});
