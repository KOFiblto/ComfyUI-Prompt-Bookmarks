import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "vdeng.PromptBookmarks.GroupSuggestions";
const DATALIST_PREFIX = "prompt-bookmarks-group-suggestions";

function visibleGroupNames() {
  const groups = document.querySelector(".pb-root .pb-groups");
  if (!groups) return [];

  // The first chip is the current-workflow "All" filter. The remaining
  // pb-chip buttons are actual groups; the edit button is filtered out.
  const chips = [...groups.querySelectorAll("button.pb-chip")].slice(1);
  return [...new Set(
    chips
      .map((button) => String(button.textContent || "").trim())
      .filter((name) => name && name !== "✎")
  )];
}

function enhanceSaveDialog(dialog) {
  if (!(dialog instanceof Element) || dialog.dataset.pbGroupSuggestions === "1") return;

  const inputs = [...dialog.querySelectorAll(".pb-dialog-body input.pb-input")];
  if (inputs.length < 2) return;

  const groupInput = inputs[1];
  const names = visibleGroupNames();
  if (!names.length) return;

  dialog.dataset.pbGroupSuggestions = "1";
  const list = document.createElement("datalist");
  list.id = `${DATALIST_PREFIX}-${Math.random().toString(36).slice(2)}`;

  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    list.appendChild(option);
  }

  groupInput.setAttribute("list", list.id);
  groupInput.insertAdjacentElement("afterend", list);
}

function inspect(node) {
  if (!(node instanceof Element)) return;
  if (node.matches(".pb-dialog")) enhanceSaveDialog(node);
  node.querySelectorAll?.(".pb-dialog").forEach(enhanceSaveDialog);
}

app.registerExtension({
  name: EXTENSION_NAME,
  setup() {
    document.querySelectorAll(".pb-dialog").forEach(enhanceSaveDialog);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) inspect(node);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },
});
