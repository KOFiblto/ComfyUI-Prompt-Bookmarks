import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const EXTENSION_NAME = "vdeng.PromptBookmarks";
const API_BASE = "/prompt-bookmarks";
const LANG_SETTING = "PromptBookmarks.Language";
const AUTOLINK_SETTING = "PromptBookmarks.AutoLinkMedia";

const state = {
  root: null,
  workflow: null,
  bindings: [],
  groups: [],
  prompts: [],
  allGroups: [],
  allMode: false,
  groupId: null,
  allGroupName: null,
  search: "",
  lastWorkflowKey: "",
  lastLanguage: "",
  autoPromptedWorkflowKey: "",
  syncTimer: null,
};

const I18N = {
  "zh-CN": {
    title: "提示词收藏",
    tooltip: "个人提示词收藏夹",
    currentWorkflow: "当前工作流",
    allWorkflows: "全部工作流",
    noActiveWorkflow: "未打开工作流",
    untitledWorkflow: "未命名工作流",
    search: "搜索提示词...",
    all: "全部",
    saveCurrent: "＋ 收藏当前提示词",
    configure: "选择提示词字段",
    configureTitle: "选择要收藏的提示词",
    configureDesc: "插件已自动发现当前工作流中可编辑的文本字段。勾选需要一起收藏和恢复的字段即可，不需要填写节点编号。",
    autoDetected: "推荐",
    locate: "定位",
    noTextWidgets: "没有发现可编辑的文本字段",
    noTextWidgetsDetail: "当前层级没有可直接编辑的字符串字段。组合节点/子图请先将需要的文本字段暴露到外层。",
    cancel: "取消",
    saveSelection: "保存选择",
    selectedCount: "已选择 {count} 个字段",
    selectionSaved: "提示词字段已保存",
    fieldConfigured: "已配置 {count} 个字段",
    nothingToSave: "没有可收藏的内容",
    missingConfiguredFields: "当前工作流没有匹配到已配置字段，请重新选择提示词字段。",
    bookmarkName: "收藏名称",
    bookmarkNamePlaceholder: "例如：女孩自然回头",
    groupOptional: "分组（可选）",
    groupPlaceholder: "例如：人物 / 运镜 / 产品",
    fieldsToSave: "将收藏以下字段",
    createBookmark: "收藏",
    promptBookmarked: "已收藏提示词",
    apply: "应用",
    copy: "复制",
    delete: "删除",
    deleteConfirm: "删除“{name}”？生成文件不会被删除。",
    promptApplied: "提示词已应用",
    appliedDetail: "已更新 {applied} 个字段{missing}",
    missingSuffix: "，{count} 个字段未找到",
    copied: "已复制",
    copyFailed: "复制失败",
    mediaCount: "{count} 个预览",
    workflow: "工作流",
    openWorkflow: "打开一个工作流后即可使用提示词收藏。",
    noBindings: "还没有选择这个工作流需要收藏的提示词字段。",
    chooseFields: "选择提示词字段",
    noMatch: "没有符合搜索条件的提示词。",
    noSaved: "还没有收藏提示词。",
    settings: "设置",
    language: "语言",
    languageAuto: "跟随 ComfyUI / 浏览器",
    languageZh: "简体中文",
    languageEn: "English",
    autoLink: "自动关联生成结果",
    promptFields: "提示词字段",
    reselect: "重新选择",
    close: "关闭",
    locateFailed: "无法定位节点",
    exposedOnly: "当前版本仅处理当前画布及组合节点/子图对外暴露的可编辑字段。",
    saveBeforeBookmark: "第一次收藏前，需要先选择哪些文本字段属于这组提示词。",
  },
  "en-US": {
    title: "Prompt Bookmarks",
    tooltip: "Personal prompt bookmarks",
    currentWorkflow: "Current workflow",
    allWorkflows: "All workflows",
    noActiveWorkflow: "No active workflow",
    untitledWorkflow: "Untitled Workflow",
    search: "Search prompts...",
    all: "All",
    saveCurrent: "＋ Save Current Prompt",
    configure: "Choose Prompt Fields",
    configureTitle: "Choose Prompt Fields",
    configureDesc: "Prompt Bookmarks found editable text fields in this workflow. Select the fields that should be saved and restored together. You never need to enter node IDs.",
    autoDetected: "Recommended",
    locate: "Locate",
    noTextWidgets: "No editable text fields found",
    noTextWidgetsDetail: "No directly editable string fields were found at the current level. For group nodes/subgraphs, expose the text field on the outer node first.",
    cancel: "Cancel",
    saveSelection: "Save Selection",
    selectedCount: "{count} fields selected",
    selectionSaved: "Prompt fields saved",
    fieldConfigured: "{count} fields configured",
    nothingToSave: "Nothing to save",
    missingConfiguredFields: "No configured fields match this workflow. Please choose prompt fields again.",
    bookmarkName: "Bookmark name",
    bookmarkNamePlaceholder: "e.g. Natural head turn",
    groupOptional: "Group (optional)",
    groupPlaceholder: "e.g. Character / Camera / Product",
    fieldsToSave: "Fields to save",
    createBookmark: "Save",
    promptBookmarked: "Prompt bookmarked",
    apply: "Apply",
    copy: "Copy",
    delete: "Delete",
    deleteConfirm: "Delete “{name}”? Generated files will not be deleted.",
    promptApplied: "Prompt applied",
    appliedDetail: "{applied} fields updated{missing}",
    missingSuffix: ", {count} missing",
    copied: "Copied",
    copyFailed: "Copy failed",
    mediaCount: "{count} previews",
    workflow: "Workflow",
    openWorkflow: "Open a workflow to start using Prompt Bookmarks.",
    noBindings: "No prompt fields are selected for this workflow yet.",
    chooseFields: "Choose Prompt Fields",
    noMatch: "No prompts match your search.",
    noSaved: "No saved prompts yet.",
    settings: "Settings",
    language: "Language",
    languageAuto: "Follow ComfyUI / browser",
    languageZh: "简体中文",
    languageEn: "English",
    autoLink: "Automatically link generated media",
    promptFields: "Prompt Fields",
    reselect: "Reselect",
    close: "Close",
    locateFailed: "Could not locate node",
    exposedOnly: "This version only works with editable fields visible on the current canvas or exposed by group nodes/subgraphs.",
    saveBeforeBookmark: "Before the first bookmark, choose which text fields belong to this prompt set.",
  },
};

function settingGet(id, fallback = null) {
  try { return app.extensionManager?.setting?.get?.(id) ?? fallback; } catch (_) { return fallback; }
}
function language() {
  const configured = settingGet(LANG_SETTING, "auto");
  if (configured === "zh-CN" || configured === "en-US") return configured;
  const comfyLocale = settingGet("Comfy.Locale", "") || settingGet("Comfy.Locale.Language", "");
  const raw = String(comfyLocale || navigator.language || "en-US").toLowerCase();
  return raw.startsWith("zh") ? "zh-CN" : "en-US";
}
function t(key, vars = {}) {
  let value = I18N[language()]?.[key] ?? I18N["en-US"]?.[key] ?? key;
  for (const [name, replacement] of Object.entries(vars)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}
function refreshExtensionLabels() {
  const settings = app.extensionManager?.setting?.settings;
  const category = t("title");
  const langSetting = settings?.[LANG_SETTING];
  if (langSetting) {
    langSetting.name = t("language");
    langSetting.category = [category];
    langSetting.options = [
      { value: "auto", text: t("languageAuto") },
      { value: "zh-CN", text: t("languageZh") },
      { value: "en-US", text: t("languageEn") },
    ];
  }
  const autoLinkSetting = settings?.[AUTOLINK_SETTING];
  if (autoLinkSetting) {
    autoLinkSetting.name = t("autoLink");
    autoLinkSetting.category = [category];
  }
  const tab = app.extensionManager?.getSidebarTabs?.().find((item) => item.id === "prompt-bookmarks");
  if (tab) {
    tab.title = t("title");
    tab.tooltip = t("tooltip");
  }
}

function injectStyles() {
  if (document.getElementById("prompt-bookmarks-styles")) return;
  const style = document.createElement("style");
  style.id = "prompt-bookmarks-styles";
  style.textContent = `
    .pb-root{height:100%;display:flex;flex-direction:column;color:var(--fg-color);background:var(--comfy-menu-bg);font-size:13px}
    .pb-head{padding:12px;border-bottom:1px solid var(--border-color);display:flex;flex-direction:column;gap:8px}
    .pb-row{display:flex;align-items:center;gap:6px}.pb-title{font-size:15px;font-weight:650;flex:1}.pb-wf{font-size:12px;color:var(--descrip-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pb-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px}.pb-btn,.pb-tab,.pb-chip{border:1px solid var(--border-color);background:var(--comfy-input-bg);color:var(--fg-color);border-radius:6px;padding:6px 8px;cursor:pointer;font:inherit}.pb-btn:disabled{opacity:.4;cursor:not-allowed}.pb-tab.active,.pb-chip.active{background:var(--comfy-menu-secondary-bg)}
    .pb-search,.pb-input,.pb-select{width:100%;box-sizing:border-box;border:1px solid var(--border-color);background:var(--comfy-input-bg);color:var(--input-text);border-radius:6px;padding:8px;outline:none}.pb-groups{display:flex;gap:5px;overflow-x:auto}.pb-chip{white-space:nowrap;border-radius:999px;padding:4px 8px;font-size:12px}
    .pb-body{flex:1;overflow:auto;padding:10px}.pb-empty{color:var(--descrip-text);text-align:center;padding:28px 12px;line-height:1.6}.pb-empty .pb-btn{margin-top:10px}
    .pb-card{border:1px solid var(--border-color);border-radius:9px;overflow:hidden;margin-bottom:10px;background:var(--comfy-input-bg)}.pb-media{width:100%;aspect-ratio:16/9;display:block;object-fit:cover;background:#111}.pb-cardbody{padding:9px;display:flex;flex-direction:column;gap:6px}.pb-cardtitle{font-size:14px;font-weight:650}.pb-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--descrip-text)}.pb-badge{border:1px solid var(--border-color);border-radius:5px;padding:1px 5px}.pb-snippet{font-size:12px;line-height:1.45;color:var(--descrip-text);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;word-break:break-word}.pb-actions{display:flex;gap:5px}.pb-actions .pb-btn{flex:1;padding:5px 6px}.pb-danger{color:#ff7777}
    .pb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.52);display:flex;align-items:center;justify-content:center;z-index:100000;padding:18px}.pb-dialog{width:min(680px,95vw);max-height:88vh;display:flex;flex-direction:column;background:var(--comfy-menu-bg);border:1px solid var(--border-color);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.45);color:var(--fg-color)}.pb-dialog-head,.pb-dialog-foot{padding:14px;display:flex;align-items:center;gap:8px}.pb-dialog-head{border-bottom:1px solid var(--border-color)}.pb-dialog-title{font-size:16px;font-weight:700;flex:1}.pb-dialog-body{padding:14px;overflow:auto;display:flex;flex-direction:column;gap:12px}.pb-dialog-foot{border-top:1px solid var(--border-color);justify-content:flex-end}.pb-help{font-size:12px;line-height:1.5;color:var(--descrip-text)}
    .pb-candidate{border:1px solid var(--border-color);border-radius:8px;padding:10px;display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:start}.pb-candidate-main{min-width:0}.pb-candidate-title{font-weight:650;display:flex;align-items:center;gap:6px;flex-wrap:wrap}.pb-recommended{font-size:10px;border:1px solid var(--border-color);border-radius:999px;padding:1px 5px;color:var(--descrip-text)}.pb-path{font-size:11px;color:var(--descrip-text);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pb-preview{font-size:12px;color:var(--descrip-text);margin-top:6px;white-space:pre-wrap;word-break:break-word;max-height:62px;overflow:hidden}.pb-label{font-size:12px;color:var(--descrip-text);margin-bottom:5px}.pb-field-preview{border:1px solid var(--border-color);background:var(--comfy-input-bg);border-radius:6px;padding:8px;white-space:pre-wrap;word-break:break-word;max-height:110px;overflow:auto}.pb-section{display:flex;flex-direction:column;gap:6px}.pb-settings-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color)}
  `;
  document.head.appendChild(style);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const response = await api.fetchApi(`${API_BASE}${path}`, { ...options, headers });
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `${response.status} ${response.statusText}`);
  return payload?.data;
}
function notify(severity, summary, detail = "") { app.extensionManager?.toast?.add?.({ severity, summary, detail, life: 2600 }); }
function button(text, handler, cls = "") {
  const el = document.createElement("button"); el.className = `pb-btn ${cls}`.trim(); el.textContent = text;
  el.onclick = () => Promise.resolve(handler?.()).catch((err) => notify("error", t("title"), String(err?.message || err))); return el;
}
function field(labelText, control) {
  const wrap = document.createElement("div"); wrap.className = "pb-section";
  const label = document.createElement("div"); label.className = "pb-label"; label.textContent = labelText; wrap.append(label, control); return wrap;
}
function openDialog(titleText) {
  const overlay = document.createElement("div"); overlay.className = "pb-overlay";
  const dialog = document.createElement("div"); dialog.className = "pb-dialog";
  const head = document.createElement("div"); head.className = "pb-dialog-head";
  const title = document.createElement("div"); title.className = "pb-dialog-title"; title.textContent = titleText;
  const x = button("×", () => overlay.remove()); x.style.fontSize = "18px"; head.append(title, x);
  const body = document.createElement("div"); body.className = "pb-dialog-body";
  const foot = document.createElement("div"); foot.className = "pb-dialog-foot";
  dialog.append(head, body, foot); overlay.appendChild(dialog); document.body.appendChild(overlay);
  overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) overlay.remove(); });
  return { overlay, body, foot };
}

function activeWorkflowInfo() {
  const wf = app.extensionManager?.workflow?.activeWorkflow;
  const sourceId = wf?.activeState?.id;
  if (!sourceId) return null;
  const path = String(wf?.path || "");
  const name = String(wf?.filename || wf?.key || (path ? path.split("/").pop() : t("untitledWorkflow")) || t("untitledWorkflow"));
  return { id: String(sourceId), sourceId: String(sourceId), name, path };
}
function sameWorkflowLocation(record, info) {
  const recordPath = String(record?.path || "");
  if (info.path && recordPath) return recordPath === info.path;
  return String(record?.name || "") === info.name;
}
function collisionWorkflowId(info) {
  const discriminator = info.path || info.name || "untitled";
  return `${info.sourceId}::${encodeURIComponent(discriminator)}`;
}
async function resolveWorkflowIdentity(info) {
  const workflows = await request("/workflows") || [];
  const legacy = workflows.find((item) => String(item.workflow_id) === info.sourceId);
  if (!legacy || sameWorkflowLocation(legacy, info)) return { ...info, id: info.sourceId };
  const collisionId = collisionWorkflowId(info);
  return { ...info, id: collisionId };
}
function findNode(nodeId) {
  return app.graph?.getNodeById?.(Number.isNaN(Number(nodeId)) ? nodeId : Number(nodeId)) || app.graph?.getNodeById?.(String(nodeId)) || null;
}
function nodeTitle(node) { return String(node?.title || node?.type || node?.comfyClass || "Node"); }
function rectContains(group, node) {
  const gb = group?._bounding || group?.bounding || null; const pos = node?.pos || [0, 0]; const size = node?.size || [0, 0];
  if (!Array.isArray(gb) || gb.length < 4) return false;
  const cx = Number(pos[0]) + Number(size[0] || 0) / 2; const cy = Number(pos[1]) + Number(size[1] || 0) / 2;
  return cx >= gb[0] && cy >= gb[1] && cx <= gb[0] + gb[2] && cy <= gb[1] + gb[3];
}
function groupPathForNode(node) {
  const groups = (app.graph?._groups || []).filter((group) => rectContains(group, node));
  groups.sort((a, b) => ((b?._bounding?.[2] || 0) * (b?._bounding?.[3] || 0)) - ((a?._bounding?.[2] || 0) * (a?._bounding?.[3] || 0)));
  return groups.map((g) => String(g.title || "Group"));
}
function promptCandidates() {
  const out = [];
  const likely = /(prompt|text|positive|negative|caption|instruction|description|motion|camera|scene|character)/i;
  const reject = /^(filename|filename_prefix|path|directory|folder|seed|url|model|ckpt|checkpoint)$/i;
  const noteLike = /(note|notes|markdown|sticky)/i;
  for (const node of app.graph?._nodes || []) {
    for (const widget of node.widgets || []) {
      if (!widget?.name || typeof widget.value !== "string") continue;
      const name = String(widget.name); if (reject.test(name)) continue;
      const title = nodeTitle(node); const type = String(node.comfyClass || node.type || node.constructor?.type || "");
      const groupPath = groupPathForNode(node); const displayPath = [...groupPath, title, name].join(" › ");
      const isNote = noteLike.test(`${title} ${type}`);
      out.push({
        node_id: String(node.id), node_type: type, widget_name: name, label: `${title} · ${name}`,
        display_path: displayPath, group_path: groupPath, preview: String(widget.value || ""),
        note_like: isNote,
        recommended: !isNote && (likely.test(name) || likely.test(title)),
      });
    }
  }
  return out.sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.display_path.localeCompare(b.display_path));
}
function locateNode(nodeId) {
  const node = findNode(nodeId); if (!node) return notify("warn", t("locateFailed"));
  try {
    app.canvas?.selectNode?.(node); app.canvas?.centerOnNode?.(node);
    if (!app.canvas?.centerOnNode && app.canvas?.ds?.offset && app.canvas?.ds?.scale) {
      const scale = app.canvas.ds.scale || 1; const canvas = app.canvas.canvas;
      app.canvas.ds.offset[0] = (canvas.width / 2) / scale - node.pos[0] - node.size[0] / 2;
      app.canvas.ds.offset[1] = (canvas.height / 2) / scale - node.pos[1] - node.size[1] / 2;
    }
    node.setDirtyCanvas?.(true, true); app.graph?.setDirtyCanvas?.(true, true);
  } catch (_) { notify("warn", t("locateFailed")); }
}
function collectCurrentFields() {
  const fields = [];
  for (const binding of state.bindings) {
    const node = findNode(binding.node_id); const widget = node?.widgets?.find((w) => w.name === binding.widget_name);
    if (!widget) continue;
    fields.push({ node_id: String(binding.node_id), node_type: String(binding.node_type || node.comfyClass || node.type || ""), widget_name: String(binding.widget_name), label: String(binding.label || binding.widget_name), value: widget.value });
  }
  return fields;
}

async function configureBindings() {
  if (!state.workflow) return;
  const candidates = promptCandidates();
  if (!candidates.length) return notify("warn", t("noTextWidgets"), t("noTextWidgetsDetail"));
  const existing = new Set(state.bindings.map((b) => `${b.node_id}::${b.widget_name}`));
  const usableExisting = candidates.some((c) => existing.has(`${c.node_id}::${c.widget_name}`));
  const selected = new Set(candidates.filter((c) => !c.note_like && (existing.has(`${c.node_id}::${c.widget_name}`) || (!usableExisting && c.recommended))).map((c) => `${c.node_id}::${c.widget_name}`));
  const dlg = openDialog(t("configureTitle"));
  const help = document.createElement("div"); help.className = "pb-help"; help.textContent = t("configureDesc"); dlg.body.appendChild(help);
  const note = document.createElement("div"); note.className = "pb-help"; note.textContent = t("exposedOnly"); dlg.body.appendChild(note);
  const count = document.createElement("div"); count.className = "pb-help";
  const updateCount = () => { count.textContent = t("selectedCount", { count: selected.size }); }; updateCount(); dlg.body.appendChild(count);
  for (const c of candidates) {
    const row = document.createElement("div"); row.className = "pb-candidate";
    const check = document.createElement("input"); check.type = "checkbox"; const key = `${c.node_id}::${c.widget_name}`; check.checked = selected.has(key);
    check.onchange = () => { check.checked ? selected.add(key) : selected.delete(key); updateCount(); };
    const main = document.createElement("div"); main.className = "pb-candidate-main";
    const title = document.createElement("div"); title.className = "pb-candidate-title"; title.textContent = `${nodeTitle(findNode(c.node_id))} · ${c.widget_name}`;
    if (c.recommended) { const badge = document.createElement("span"); badge.className = "pb-recommended"; badge.textContent = t("autoDetected"); title.appendChild(badge); }
    const path = document.createElement("div"); path.className = "pb-path"; path.textContent = c.display_path; main.append(title, path);
    if (c.preview.trim()) { const preview = document.createElement("div"); preview.className = "pb-preview"; preview.textContent = c.preview; main.appendChild(preview); }
    row.append(check, main, button(t("locate"), () => locateNode(c.node_id))); dlg.body.appendChild(row);
  }
  dlg.foot.append(button(t("cancel"), () => dlg.overlay.remove()), button(t("saveSelection"), async () => {
    const bindings = candidates.filter((c) => selected.has(`${c.node_id}::${c.widget_name}`)).map((c, index) => ({ node_id: c.node_id, node_type: c.node_type, widget_name: c.widget_name, label: c.label, sort_order: index }));
    await request("/bindings", { method: "PUT", body: JSON.stringify({ workflow_id: state.workflow.id, bindings }) });
    state.bindings = await request(`/bindings?workflow_id=${encodeURIComponent(state.workflow.id)}`) || [];
    dlg.overlay.remove(); render(); notify("success", t("selectionSaved"), t("fieldConfigured", { count: state.bindings.length }));
  }));
}
function maybeAutoConfigure() {
  if (!state.root || state.allMode || !state.workflow) return;
  if (state.bindings.length && collectCurrentFields().length) return;
  if (!promptCandidates().length) return;
  if (state.autoPromptedWorkflowKey === state.workflow.id) return;
  state.autoPromptedWorkflowKey = state.workflow.id;
  setTimeout(() => { if (state.root && !state.allMode && state.workflow?.id === state.autoPromptedWorkflowKey) configureBindings().catch(console.error); }, 0);
}

async function saveCurrentPrompt() {
  if (!state.workflow) return;
  const fields = collectCurrentFields();
  if (!state.bindings.length || !fields.length) {
    notify("info", t("configure"), state.bindings.length ? t("missingConfiguredFields") : t("saveBeforeBookmark"));
    return configureBindings();
  }
  const dlg = openDialog(t("saveCurrent"));
  const name = document.createElement("input"); name.className = "pb-input"; name.placeholder = t("bookmarkNamePlaceholder"); name.autofocus = true;
  const group = document.createElement("input"); group.className = "pb-input"; group.placeholder = t("groupPlaceholder");
  dlg.body.append(field(t("bookmarkName"), name), field(t("groupOptional"), group));
  const fieldsSection = document.createElement("div"); fieldsSection.className = "pb-section";
  const fieldsLabel = document.createElement("div"); fieldsLabel.className = "pb-label"; fieldsLabel.textContent = t("fieldsToSave"); fieldsSection.appendChild(fieldsLabel);
  for (const f of fields) { const p = document.createElement("div"); p.className = "pb-field-preview"; p.textContent = `${f.label}\n${String(f.value ?? "")}`; fieldsSection.appendChild(p); }
  dlg.body.appendChild(fieldsSection);
  dlg.foot.append(button(t("cancel"), () => dlg.overlay.remove()), button(t("createBookmark"), async () => {
    const cleanedName = name.value.trim(); if (!cleanedName) { name.focus(); return; }
    const groupName = group.value.trim(); let groupId = null;
    if (groupName) {
      let found = state.groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
      if (!found) found = await request("/groups", { method: "POST", body: JSON.stringify({ workflow_id: state.workflow.id, name: groupName }) });
      groupId = found.id;
    }
    await request("/prompts", { method: "POST", body: JSON.stringify({ workflow_id: state.workflow.id, group_id: groupId, name: cleanedName, fields, notes: "" }) });
    dlg.overlay.remove(); await loadData(); notify("success", t("promptBookmarked"), cleanedName);
  }));
  setTimeout(() => name.focus(), 0);
}

function applyPrompt(prompt) {
  let applied = 0; const missing = [];
  for (const field of prompt.fields || []) {
    const node = findNode(field.node_id); const widget = node?.widgets?.find((w) => w.name === field.widget_name);
    if (!widget) { missing.push(field.label || field.widget_name); continue; }
    widget.value = field.value; widget.callback?.(field.value, app.canvas, node, widget); node.setDirtyCanvas?.(true, true); applied += 1;
  }
  if (applied) { app.graph?.setDirtyCanvas?.(true, true); request(`/prompts/${encodeURIComponent(prompt.id)}/used`, { method: "POST" }).catch(() => {}); }
  const missingText = missing.length ? t("missingSuffix", { count: missing.length }) : "";
  notify(missing.length ? "warn" : "success", t("promptApplied"), t("appliedDetail", { applied, missing: missingText }));
}
async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch (_) {}
  }
  const textarea = document.createElement("textarea");
  textarea.value = text; textarea.setAttribute("readonly", ""); textarea.style.position = "fixed"; textarea.style.opacity = "0"; textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea); textarea.focus(); textarea.select(); textarea.setSelectionRange(0, textarea.value.length);
  let copied = false;
  try { copied = document.execCommand("copy"); } finally { textarea.remove(); }
  if (!copied) throw new Error(t("copyFailed"));
}
async function copyPrompt(prompt) {
  const fields = prompt.fields || [];
  const text = fields.length === 1 ? String(fields[0].value ?? "") : fields.map((f) => `${f.label || f.widget_name}:\n${String(f.value ?? "")}`).join("\n\n");
  await writeClipboard(text); notify("success", t("copied"), prompt.name);
}
async function deletePrompt(prompt) {
  if (!window.confirm(t("deleteConfirm", { name: prompt.name }))) return;
  await request(`/prompts/${encodeURIComponent(prompt.id)}`, { method: "DELETE" }); await loadPrompts();
}
function mediaUrl(media) { const q = new URLSearchParams({ filename: media.filename || "", subfolder: media.subfolder || "", type: media.type || "output" }); return `/view?${q.toString()}`; }
function isVideo(media) { return media?.media_type === "video" || /\.(mp4|webm|mov|mkv|m4v)$/i.test(media?.filename || ""); }

async function loadPrompts() {
  if (!state.workflow && !state.allMode) { state.prompts = []; state.allGroups = []; render(); return; }
  const params = new URLSearchParams({ limit: "500" });
  if (!state.allMode && state.workflow) params.set("workflow_id", state.workflow.id);
  if (!state.allMode && state.groupId != null) params.set("group_id", String(state.groupId));
  if (state.search.trim()) params.set("q", state.search.trim());
  const rows = await request(`/prompts?${params.toString()}`) || [];
  if (state.allMode) {
    state.allGroups = [...new Set(rows.map((p) => String(p.group_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    state.prompts = state.allGroupName ? rows.filter((p) => p.group_name === state.allGroupName) : rows;
  } else {
    state.allGroups = [];
    state.prompts = rows;
  }
  render();
}
async function loadData() {
  if (!state.workflow) { state.bindings = []; state.groups = []; if (!state.allMode) state.prompts = []; render(); return; }
  const before = state.workflow;
  const resolved = await resolveWorkflowIdentity(before);
  if (!state.workflow || state.workflow.sourceId !== before.sourceId || state.workflow.path !== before.path) return;
  state.workflow = resolved;
  await request("/workflows", { method: "POST", body: JSON.stringify({ workflow_id: resolved.id, name: resolved.name, path: resolved.path }) });
  [state.bindings, state.groups] = await Promise.all([
    request(`/bindings?workflow_id=${encodeURIComponent(resolved.id)}`),
    request(`/groups?workflow_id=${encodeURIComponent(resolved.id)}`),
  ]);
  await loadPrompts(); maybeAutoConfigure();
}

function showSettings() {
  const dlg = openDialog(t("settings"));
  const languageRow = document.createElement("div"); languageRow.className = "pb-settings-row";
  const languageText = document.createElement("div"); languageText.textContent = t("language");
  const languageSelect = document.createElement("select"); languageSelect.className = "pb-select";
  for (const [value, label] of [["auto", t("languageAuto")], ["zh-CN", t("languageZh")], ["en-US", t("languageEn")]]) {
    const option = document.createElement("option"); option.value = value; option.textContent = label; languageSelect.appendChild(option);
  }
  languageSelect.value = settingGet(LANG_SETTING, "auto");
  languageSelect.onchange = async () => { await app.extensionManager?.setting?.set?.(LANG_SETTING, languageSelect.value); refreshExtensionLabels(); dlg.overlay.remove(); render(); showSettings(); };
  languageRow.append(languageText, languageSelect); dlg.body.appendChild(languageRow);
  const autoRow = document.createElement("div"); autoRow.className = "pb-settings-row";
  const autoText = document.createElement("div"); autoText.textContent = t("autoLink");
  const auto = document.createElement("input"); auto.type = "checkbox"; auto.checked = settingGet(AUTOLINK_SETTING, true) !== false;
  auto.onchange = () => app.extensionManager?.setting?.set?.(AUTOLINK_SETTING, auto.checked); autoRow.append(autoText, auto); dlg.body.appendChild(autoRow);
  if (state.workflow) {
    const promptRow = document.createElement("div"); promptRow.className = "pb-settings-row";
    const promptInfo = document.createElement("div"); promptInfo.innerHTML = `<div>${t("promptFields")}</div><div class="pb-help">${t("fieldConfigured", { count: state.bindings.length })}</div>`;
    promptRow.append(promptInfo, button(t("reselect"), () => { dlg.overlay.remove(); configureBindings(); })); dlg.body.appendChild(promptRow);
  }
  const note = document.createElement("div"); note.className = "pb-help"; note.textContent = t("exposedOnly"); dlg.body.appendChild(note);
  dlg.foot.append(button(t("close"), () => dlg.overlay.remove()));
}

function renderCard(prompt) {
  const card = document.createElement("div"); card.className = "pb-card";
  if (prompt.latest_media) {
    const media = isVideo(prompt.latest_media) ? document.createElement("video") : document.createElement("img"); media.className = "pb-media"; media.src = mediaUrl(prompt.latest_media);
    if (media.tagName === "VIDEO") { media.controls = true; media.muted = true; media.preload = "metadata"; } else media.loading = "lazy"; card.appendChild(media);
  }
  const body = document.createElement("div"); body.className = "pb-cardbody";
  const title = document.createElement("div"); title.className = "pb-cardtitle"; title.textContent = prompt.name; body.appendChild(title);
  const meta = document.createElement("div"); meta.className = "pb-meta";
  if (state.allMode) { const b = document.createElement("span"); b.className = "pb-badge"; b.textContent = prompt.workflow_name || t("workflow"); meta.appendChild(b); }
  if (prompt.group_name) { const b = document.createElement("span"); b.className = "pb-badge"; b.textContent = prompt.group_name; meta.appendChild(b); }
  if (prompt.media_count) { const b = document.createElement("span"); b.textContent = t("mediaCount", { count: prompt.media_count }); meta.appendChild(b); }
  body.appendChild(meta);
  const first = (prompt.fields || []).find((f) => String(f.value || "").trim());
  if (first) { const s = document.createElement("div"); s.className = "pb-snippet"; s.textContent = String(first.value || ""); body.appendChild(s); }
  const actions = document.createElement("div"); actions.className = "pb-actions";
  const apply = button(t("apply"), () => applyPrompt(prompt)); apply.disabled = !state.workflow || prompt.workflow_id !== state.workflow.id;
  actions.append(apply, button(t("copy"), () => copyPrompt(prompt)), button(t("delete"), () => deletePrompt(prompt), "pb-danger")); body.appendChild(actions); card.appendChild(body); return card;
}
function renderGroupFilters(head) {
  const groups = document.createElement("div"); groups.className = "pb-groups";
  if (state.allMode) {
    groups.appendChild(button(t("all"), async () => { state.allGroupName = null; await loadPrompts(); }, `pb-chip ${state.allGroupName == null ? "active" : ""}`));
    for (const name of state.allGroups) groups.appendChild(button(name, async () => { state.allGroupName = name; await loadPrompts(); }, `pb-chip ${state.allGroupName === name ? "active" : ""}`));
  } else if (state.workflow) {
    groups.appendChild(button(t("all"), async () => { state.groupId = null; await loadPrompts(); }, `pb-chip ${state.groupId == null ? "active" : ""}`));
    for (const g of state.groups || []) groups.appendChild(button(g.name, async () => { state.groupId = g.id; await loadPrompts(); }, `pb-chip ${state.groupId === g.id ? "active" : ""}`));
  }
  if (groups.childElementCount) head.appendChild(groups);
}
function render() {
  if (!state.root) return; state.root.replaceChildren();
  const head = document.createElement("div"); head.className = "pb-head";
  const top = document.createElement("div"); top.className = "pb-row";
  const title = document.createElement("div"); title.className = "pb-title"; title.textContent = t("title"); top.append(title, button("⚙", showSettings)); head.appendChild(top);
  const wf = document.createElement("div"); wf.className = "pb-wf"; wf.textContent = state.workflow?.name || t("noActiveWorkflow"); head.appendChild(wf);
  const tabs = document.createElement("div"); tabs.className = "pb-tabs";
  tabs.append(
    button(t("currentWorkflow"), async () => { state.allMode = false; state.groupId = null; state.allGroupName = null; await loadPrompts(); maybeAutoConfigure(); }, `pb-tab ${!state.allMode ? "active" : ""}`),
    button(t("allWorkflows"), async () => { state.allMode = true; state.groupId = null; state.allGroupName = null; await loadPrompts(); }, `pb-tab ${state.allMode ? "active" : ""}`),
  );
  head.appendChild(tabs);
  const search = document.createElement("input"); search.className = "pb-search"; search.placeholder = t("search"); search.value = state.search; let timer;
  search.oninput = () => { state.search = search.value; clearTimeout(timer); timer = setTimeout(() => loadPrompts().catch(console.error), 220); }; head.appendChild(search);
  renderGroupFilters(head);
  const save = button(t("saveCurrent"), saveCurrentPrompt); save.disabled = !state.workflow; head.appendChild(save); state.root.appendChild(head);
  const body = document.createElement("div"); body.className = "pb-body";
  if (!state.workflow && !state.allMode) { const e = document.createElement("div"); e.className = "pb-empty"; e.textContent = t("openWorkflow"); body.appendChild(e); }
  else if ((!state.bindings.length || !collectCurrentFields().length) && !state.allMode) {
    const e = document.createElement("div"); e.className = "pb-empty"; const text = document.createElement("div"); text.textContent = t("noBindings"); e.append(text, button(t("chooseFields"), configureBindings)); body.appendChild(e);
  } else if (!state.prompts.length) { const e = document.createElement("div"); e.className = "pb-empty"; e.textContent = state.search ? t("noMatch") : t("noSaved"); body.appendChild(e); }
  else for (const p of state.prompts) body.appendChild(renderCard(p)); state.root.appendChild(body);
}

async function syncActiveWorkflow(force = false) {
  const current = activeWorkflowInfo(); const key = current ? `${current.sourceId}|${current.path}|${current.name}` : ""; const lang = language();
  if (!force && key === state.lastWorkflowKey && lang === state.lastLanguage) return;
  if (!force && key === state.lastWorkflowKey && lang !== state.lastLanguage) { state.lastLanguage = lang; refreshExtensionLabels(); render(); return; }
  state.lastWorkflowKey = key; state.lastLanguage = lang; state.workflow = current; state.groupId = null; state.allGroupName = null; await loadData();
}
function extractPromptGraph(history) {
  const p = history?.prompt; if (Array.isArray(p)) return p[2] && typeof p[2] === "object" ? p[2] : {}; if (p?.prompt && typeof p.prompt === "object") return p.prompt; return {};
}
function extractWorkflowSourceId(history) {
  if (history?.workflow_id) return String(history.workflow_id);
  const p = history?.prompt;
  if (Array.isArray(p)) return String(p?.[3]?.extra_pnginfo?.workflow?.id || p?.[3]?.workflow_id || "") || null;
  return String(p?.extra_data?.extra_pnginfo?.workflow?.id || p?.extra_data?.workflow_id || "") || null;
}
async function resolveHistoryWorkflowId(history) {
  const sourceId = extractWorkflowSourceId(history);
  if (!sourceId) return state.workflow?.id || null;
  if (state.workflow?.sourceId === sourceId) return state.workflow.id;
  return sourceId;
}
function fieldsFromHistory(history, bindings) {
  const graph = extractPromptGraph(history); const fields = [];
  for (const b of bindings) {
    const node = graph?.[String(b.node_id)]; if (!node?.inputs || !(b.widget_name in node.inputs)) continue;
    const value = node.inputs[b.widget_name]; if (Array.isArray(value) && value.length === 2) continue;
    fields.push({ node_id: String(b.node_id), node_type: String(b.node_type || node.class_type || ""), widget_name: String(b.widget_name), label: String(b.label || b.widget_name), value });
  }
  return fields;
}
function collectMedia(outputs) {
  const media = [], seen = new Set();
  const visit = (value, key = "") => {
    if (!value) return; if (Array.isArray(value)) return value.forEach((v) => visit(v, key)); if (typeof value !== "object") return;
    if (typeof value.filename === "string" && value.filename) {
      const sig = `${value.filename}|${value.subfolder || ""}|${value.type || "output"}`; if (seen.has(sig)) return; seen.add(sig);
      media.push({ filename: value.filename, subfolder: value.subfolder || "", type: value.type || "output", media_type: /video|gifs?/i.test(key) || /\.(mp4|webm|mov|mkv|m4v)$/i.test(value.filename) ? "video" : "image" }); return;
    }
    for (const [k, v] of Object.entries(value)) visit(v, k);
  };
  visit(outputs || {}); return media;
}
async function historyWithRetry(promptId) {
  for (const delay of [0, 100, 250, 500, 900, 1500, 2500]) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try { const r = await api.fetchApi(`/history/${encodeURIComponent(promptId)}`); if (!r.ok) continue; const data = await r.json(); const h = data?.[promptId]; if (h && Object.keys(h.outputs || {}).length) return h; } catch (_) {}
  }
  return null;
}
async function onExecutionSuccess(event) {
  const promptId = event?.detail?.prompt_id; if (!promptId) return;
  try {
    const history = await historyWithRetry(String(promptId)); if (!history) return;
    const workflowId = await resolveHistoryWorkflowId(history); if (!workflowId) return;
    const bindings = await request(`/bindings?workflow_id=${encodeURIComponent(workflowId)}`); if (!bindings?.length) return;
    const fields = fieldsFromHistory(history, bindings), media = collectMedia(history.outputs); if (!fields.length || !media.length) return;
    const result = await request("/media/link", { method: "POST", body: JSON.stringify({ workflow_id: workflowId, fields, execution_id: String(promptId), media }) });
    if (result?.linked_prompt_ids?.length && state.workflow?.id === workflowId) await loadPrompts();
  } catch (err) { console.warn("[Prompt Bookmarks] media auto-link failed", err); }
}

app.registerExtension({
  name: EXTENSION_NAME,
  settings: [
    {
      id: LANG_SETTING,
      name: "Language",
      category: ["Prompt Bookmarks"],
      type: "combo",
      options: [{ value: "auto", text: "Auto" }, { value: "zh-CN", text: "简体中文" }, { value: "en-US", text: "English" }],
      defaultValue: "auto",
      onChange: () => setTimeout(() => { refreshExtensionLabels(); render(); }, 0),
    },
    {
      id: AUTOLINK_SETTING,
      name: "Automatically link generated media",
      category: ["Prompt Bookmarks"],
      type: "boolean",
      defaultValue: true,
    },
  ],
  async setup() {
    injectStyles();
    refreshExtensionLabels();
    app.extensionManager.registerSidebarTab({
      id: "prompt-bookmarks", icon: "pi pi-bookmark", title: t("title"), tooltip: t("tooltip"), type: "custom",
      render: (element) => { state.root = element; element.classList.add("pb-root"); render(); syncActiveWorkflow(true).catch(console.error); },
      destroy: () => { state.root = null; },
    });
    refreshExtensionLabels();
    syncActiveWorkflow(true).catch(console.error); state.syncTimer ||= setInterval(() => syncActiveWorkflow(false).catch(console.error), 750);
    api.addEventListener("execution_success", (event) => { if (settingGet(AUTOLINK_SETTING, true) !== false) onExecutionSuccess(event); });
  },
});
