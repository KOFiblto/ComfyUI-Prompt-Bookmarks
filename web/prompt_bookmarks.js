import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const EXTENSION_NAME = "vdeng.PromptBookmarks";
const API_BASE = "/prompt-bookmarks";

const state = {
  root: null,
  workflow: null,
  bindings: [],
  groups: [],
  prompts: [],
  allMode: false,
  groupId: null,
  search: "",
  lastWorkflowKey: "",
  syncTimer: null,
};

function injectStyles() {
  if (document.getElementById("prompt-bookmarks-styles")) return;
  const style = document.createElement("style");
  style.id = "prompt-bookmarks-styles";
  style.textContent = `
    .pb-root{height:100%;display:flex;flex-direction:column;color:var(--fg-color);background:var(--comfy-menu-bg);font-size:13px}
    .pb-head{padding:12px;border-bottom:1px solid var(--border-color);display:flex;flex-direction:column;gap:8px}
    .pb-row{display:flex;align-items:center;gap:6px}.pb-title{font-size:15px;font-weight:650;flex:1}.pb-wf{font-size:12px;color:var(--descrip-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pb-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px}.pb-btn,.pb-tab,.pb-chip{border:1px solid var(--border-color);background:var(--comfy-input-bg);color:var(--fg-color);border-radius:6px;padding:6px 8px;cursor:pointer;font:inherit}.pb-btn:disabled{opacity:.4;cursor:not-allowed}.pb-tab.active,.pb-chip.active{background:var(--comfy-menu-secondary-bg)}
    .pb-search{width:100%;box-sizing:border-box;border:1px solid var(--border-color);background:var(--comfy-input-bg);color:var(--input-text);border-radius:6px;padding:8px;outline:none}.pb-groups{display:flex;gap:5px;overflow-x:auto}.pb-chip{white-space:nowrap;border-radius:999px;padding:4px 8px;font-size:12px}
    .pb-body{flex:1;overflow:auto;padding:10px}.pb-empty{color:var(--descrip-text);text-align:center;padding:28px 12px;line-height:1.6}
    .pb-card{border:1px solid var(--border-color);border-radius:9px;overflow:hidden;margin-bottom:10px;background:var(--comfy-input-bg)}.pb-media{width:100%;aspect-ratio:16/9;display:block;object-fit:cover;background:#111}.pb-cardbody{padding:9px;display:flex;flex-direction:column;gap:6px}.pb-cardtitle{font-size:14px;font-weight:650}.pb-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--descrip-text)}.pb-badge{border:1px solid var(--border-color);border-radius:5px;padding:1px 5px}.pb-snippet{font-size:12px;line-height:1.45;color:var(--descrip-text);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;word-break:break-word}.pb-actions{display:flex;gap:5px}.pb-actions .pb-btn{flex:1;padding:5px 6px}.pb-danger{color:#ff7777}
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

function notify(severity, summary, detail = "") {
  app.extensionManager?.toast?.add?.({ severity, summary, detail, life: 2600 });
}

function button(text, handler, cls = "") {
  const el = document.createElement("button");
  el.className = `pb-btn ${cls}`.trim();
  el.textContent = text;
  el.onclick = () => Promise.resolve(handler?.()).catch((err) => notify("error", "Prompt Bookmarks", String(err?.message || err)));
  return el;
}

function activeWorkflowInfo() {
  const wf = app.extensionManager?.workflow?.activeWorkflow;
  const id = wf?.activeState?.id;
  if (!id) return null;
  const path = wf?.path || "";
  const name = wf?.filename || wf?.key || (path ? path.split("/").pop() : "Untitled Workflow");
  return { id: String(id), name: String(name || "Untitled Workflow"), path: String(path || "") };
}

function findNode(nodeId) {
  return app.graph?.getNodeById?.(Number.isNaN(Number(nodeId)) ? nodeId : Number(nodeId))
    || app.graph?.getNodeById?.(String(nodeId)) || null;
}

function promptCandidates() {
  const out = [];
  const likely = /(prompt|text|positive|negative|caption|instruction|description|motion|camera)/i;
  for (const node of app.graph?._nodes || []) {
    for (const widget of node.widgets || []) {
      if (!widget?.name || typeof widget.value !== "string") continue;
      const name = String(widget.name);
      if (/^(filename|filename_prefix|path|directory|seed)$/i.test(name)) continue;
      out.push({
        node_id: String(node.id),
        node_type: String(node.comfyClass || node.type || node.constructor?.type || ""),
        widget_name: name,
        label: `${node.title || node.type || "Node"} · ${name}`,
        recommended: likely.test(name) || likely.test(String(node.title || node.type || "")),
      });
    }
  }
  return out;
}

function collectCurrentFields() {
  const fields = [];
  for (const binding of state.bindings) {
    const node = findNode(binding.node_id);
    const widget = node?.widgets?.find((w) => w.name === binding.widget_name);
    if (!widget) continue;
    fields.push({
      node_id: String(binding.node_id),
      node_type: String(binding.node_type || node.comfyClass || node.type || ""),
      widget_name: String(binding.widget_name),
      label: String(binding.label || binding.widget_name),
      value: widget.value,
    });
  }
  return fields;
}

async function configureBindings() {
  if (!state.workflow) return;
  const candidates = promptCandidates();
  if (!candidates.length) return notify("warn", "No text widgets found", "This workflow has no editable string widgets.");
  const existing = new Set(state.bindings.map((b) => `${b.node_id}::${b.widget_name}`));
  const lines = candidates.map((c, i) => `${i + 1}. ${existing.has(`${c.node_id}::${c.widget_name}`) ? "[x]" : c.recommended ? "[*]" : "[ ]"} ${c.label}`).join("\n");
  const defaults = candidates.map((c, i) => (existing.has(`${c.node_id}::${c.widget_name}`) || (!state.bindings.length && c.recommended)) ? i + 1 : null).filter(Boolean).join(",");
  const raw = window.prompt(`Choose prompt fields by number (comma separated).\n\n${lines}`, defaults);
  if (raw == null) return;
  const selected = new Set(raw.split(/[,\s]+/).map((x) => Number(x)).filter((x) => x >= 1 && x <= candidates.length));
  const bindings = candidates.filter((_, i) => selected.has(i + 1)).map((c, i) => ({ ...c, sort_order: i }));
  await request("/bindings", { method: "PUT", body: JSON.stringify({ workflow_id: state.workflow.id, bindings }) });
  state.bindings = await request(`/bindings?workflow_id=${encodeURIComponent(state.workflow.id)}`) || [];
  render();
  notify("success", "Bindings saved", `${state.bindings.length} fields configured`);
}

async function saveCurrentPrompt() {
  if (!state.workflow) return;
  if (!state.bindings.length) return configureBindings();
  const fields = collectCurrentFields();
  if (!fields.length) return notify("warn", "Nothing to save", "Configured fields are not present in this workflow.");
  const name = window.prompt("Bookmark name", "");
  if (!name?.trim()) return;
  const groupName = window.prompt("Group (optional)", "")?.trim() || "";
  let groupId = null;
  if (groupName) {
    let group = state.groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
    if (!group) group = await request("/groups", { method: "POST", body: JSON.stringify({ workflow_id: state.workflow.id, name: groupName }) });
    groupId = group.id;
  }
  await request("/prompts", { method: "POST", body: JSON.stringify({ workflow_id: state.workflow.id, group_id: groupId, name: name.trim(), fields, notes: "" }) });
  await loadData();
  notify("success", "Prompt bookmarked", name.trim());
}

function applyPrompt(prompt) {
  let applied = 0;
  const missing = [];
  for (const field of prompt.fields || []) {
    const node = findNode(field.node_id);
    const widget = node?.widgets?.find((w) => w.name === field.widget_name);
    if (!widget) { missing.push(field.label || field.widget_name); continue; }
    widget.value = field.value;
    widget.callback?.(field.value, app.canvas, node, widget);
    node.setDirtyCanvas?.(true, true);
    applied += 1;
  }
  if (applied) {
    app.graph?.setDirtyCanvas?.(true, true);
    request(`/prompts/${encodeURIComponent(prompt.id)}/used`, { method: "POST" }).catch(() => {});
  }
  notify(missing.length ? "warn" : "success", "Prompt applied", `${applied} fields updated${missing.length ? `, ${missing.length} missing` : ""}`);
}

async function copyPrompt(prompt) {
  const fields = prompt.fields || [];
  const text = fields.length === 1 ? String(fields[0].value ?? "") : fields.map((f) => `${f.label || f.widget_name}:\n${String(f.value ?? "")}`).join("\n\n");
  await navigator.clipboard.writeText(text);
  notify("success", "Copied", prompt.name);
}

async function deletePrompt(prompt) {
  if (!window.confirm(`Delete “${prompt.name}”? Generated files will not be deleted.`)) return;
  await request(`/prompts/${encodeURIComponent(prompt.id)}`, { method: "DELETE" });
  await loadPrompts();
}

function mediaUrl(media) {
  const q = new URLSearchParams({ filename: media.filename || "", subfolder: media.subfolder || "", type: media.type || "output" });
  return `/view?${q.toString()}`;
}
function isVideo(media) { return media?.media_type === "video" || /\.(mp4|webm|mov|mkv|m4v)$/i.test(media?.filename || ""); }

async function loadPrompts() {
  if (!state.workflow) { state.prompts = []; render(); return; }
  const params = new URLSearchParams({ limit: "500" });
  if (!state.allMode) params.set("workflow_id", state.workflow.id);
  if (!state.allMode && state.groupId != null) params.set("group_id", String(state.groupId));
  if (state.search.trim()) params.set("q", state.search.trim());
  state.prompts = await request(`/prompts?${params.toString()}`) || [];
  render();
}

async function loadData() {
  if (!state.workflow) { state.bindings = []; state.groups = []; state.prompts = []; render(); return; }
  await request("/workflows", { method: "POST", body: JSON.stringify({ workflow_id: state.workflow.id, name: state.workflow.name, path: state.workflow.path }) });
  [state.bindings, state.groups] = await Promise.all([
    request(`/bindings?workflow_id=${encodeURIComponent(state.workflow.id)}`),
    request(`/groups?workflow_id=${encodeURIComponent(state.workflow.id)}`),
  ]);
  await loadPrompts();
}

function renderCard(prompt) {
  const card = document.createElement("div"); card.className = "pb-card";
  if (prompt.latest_media) {
    const media = isVideo(prompt.latest_media) ? document.createElement("video") : document.createElement("img");
    media.className = "pb-media"; media.src = mediaUrl(prompt.latest_media);
    if (media.tagName === "VIDEO") { media.controls = true; media.muted = true; media.preload = "metadata"; }
    else media.loading = "lazy";
    card.appendChild(media);
  }
  const body = document.createElement("div"); body.className = "pb-cardbody";
  const title = document.createElement("div"); title.className = "pb-cardtitle"; title.textContent = prompt.name; body.appendChild(title);
  const meta = document.createElement("div"); meta.className = "pb-meta";
  if (state.allMode) { const b = document.createElement("span"); b.className = "pb-badge"; b.textContent = prompt.workflow_name || "Workflow"; meta.appendChild(b); }
  if (prompt.group_name) { const b = document.createElement("span"); b.className = "pb-badge"; b.textContent = prompt.group_name; meta.appendChild(b); }
  if (prompt.media_count) { const b = document.createElement("span"); b.textContent = `${prompt.media_count} media`; meta.appendChild(b); }
  body.appendChild(meta);
  const first = (prompt.fields || []).find((f) => String(f.value || "").trim());
  if (first) { const s = document.createElement("div"); s.className = "pb-snippet"; s.textContent = String(first.value || ""); body.appendChild(s); }
  const actions = document.createElement("div"); actions.className = "pb-actions";
  const apply = button("Apply", () => applyPrompt(prompt)); apply.disabled = !state.workflow || prompt.workflow_id !== state.workflow.id;
  actions.append(apply, button("Copy", () => copyPrompt(prompt)), button("Delete", () => deletePrompt(prompt), "pb-danger"));
  body.appendChild(actions); card.appendChild(body); return card;
}

function render() {
  if (!state.root) return;
  state.root.replaceChildren();
  const head = document.createElement("div"); head.className = "pb-head";
  const top = document.createElement("div"); top.className = "pb-row";
  const title = document.createElement("div"); title.className = "pb-title"; title.textContent = "Prompt Bookmarks";
  top.append(title, button("⚙", configureBindings)); head.appendChild(top);
  const wf = document.createElement("div"); wf.className = "pb-wf"; wf.textContent = state.workflow?.name || "No active workflow"; head.appendChild(wf);
  const tabs = document.createElement("div"); tabs.className = "pb-tabs";
  const current = button("Current workflow", async () => { state.allMode = false; state.groupId = null; await loadPrompts(); }, `pb-tab ${!state.allMode ? "active" : ""}`);
  const all = button("All workflows", async () => { state.allMode = true; state.groupId = null; await loadPrompts(); }, `pb-tab ${state.allMode ? "active" : ""}`);
  tabs.append(current, all); head.appendChild(tabs);
  const search = document.createElement("input"); search.className = "pb-search"; search.placeholder = "Search prompts..."; search.value = state.search;
  let timer; search.oninput = () => { state.search = search.value; clearTimeout(timer); timer = setTimeout(() => loadPrompts().catch(console.error), 220); }; head.appendChild(search);
  if (!state.allMode && state.workflow) {
    const groups = document.createElement("div"); groups.className = "pb-groups";
    const allChip = button("All", async () => { state.groupId = null; await loadPrompts(); }, `pb-chip ${state.groupId == null ? "active" : ""}`); groups.appendChild(allChip);
    for (const g of state.groups || []) groups.appendChild(button(g.name, async () => { state.groupId = g.id; await loadPrompts(); }, `pb-chip ${state.groupId === g.id ? "active" : ""}`));
    head.appendChild(groups);
  }
  const save = button("＋ Save current prompt", saveCurrentPrompt); save.disabled = !state.workflow; head.appendChild(save); state.root.appendChild(head);
  const body = document.createElement("div"); body.className = "pb-body";
  if (!state.workflow) { const e = document.createElement("div"); e.className = "pb-empty"; e.textContent = "Open a workflow to start using Prompt Bookmarks."; body.appendChild(e); }
  else if (!state.bindings.length && !state.allMode) { const e = document.createElement("div"); e.className = "pb-empty"; e.textContent = "No prompt fields are bound yet. Click ⚙ to choose the text fields this workflow should save."; body.appendChild(e); }
  else if (!state.prompts.length) { const e = document.createElement("div"); e.className = "pb-empty"; e.textContent = state.search ? "No prompts match your search." : "No saved prompts yet."; body.appendChild(e); }
  else for (const p of state.prompts) body.appendChild(renderCard(p));
  state.root.appendChild(body);
}

async function syncActiveWorkflow(force = false) {
  const current = activeWorkflowInfo();
  const key = current ? `${current.id}|${current.path}|${current.name}` : "";
  if (!force && key === state.lastWorkflowKey) return;
  state.lastWorkflowKey = key; state.workflow = current; state.groupId = null; await loadData();
}

function extractPromptGraph(history) {
  const p = history?.prompt;
  if (Array.isArray(p)) return p[2] && typeof p[2] === "object" ? p[2] : {};
  if (p?.prompt && typeof p.prompt === "object") return p.prompt;
  return {};
}
function extractWorkflowId(history) {
  if (history?.workflow_id) return String(history.workflow_id);
  const p = history?.prompt;
  if (Array.isArray(p)) return String(p?.[3]?.extra_pnginfo?.workflow?.id || p?.[3]?.workflow_id || state.workflow?.id || "") || null;
  return String(p?.extra_data?.extra_pnginfo?.workflow?.id || p?.extra_data?.workflow_id || state.workflow?.id || "") || null;
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
    const workflowId = extractWorkflowId(history); if (!workflowId) return;
    const bindings = await request(`/bindings?workflow_id=${encodeURIComponent(workflowId)}`); if (!bindings?.length) return;
    const fields = fieldsFromHistory(history, bindings), media = collectMedia(history.outputs); if (!fields.length || !media.length) return;
    const result = await request("/media/link", { method: "POST", body: JSON.stringify({ workflow_id: workflowId, fields, execution_id: String(promptId), media }) });
    if (result?.linked_prompt_ids?.length && state.workflow?.id === workflowId) await loadPrompts();
  } catch (err) { console.warn("[Prompt Bookmarks] media auto-link failed", err); }
}

app.registerExtension({
  name: EXTENSION_NAME,
  settings: [{ id: "PromptBookmarks.AutoLinkMedia", name: "Prompt Bookmarks: automatically link generated media", type: "boolean", defaultValue: true }],
  async setup() {
    injectStyles();
    app.extensionManager.registerSidebarTab({
      id: "prompt-bookmarks", icon: "pi pi-bookmark", title: "Prompt Bookmarks", tooltip: "Personal prompt bookmarks", type: "custom",
      render: (element) => { state.root = element; element.classList.add("pb-root"); render(); syncActiveWorkflow(true).catch(console.error); },
      destroy: () => { state.root = null; },
    });
    syncActiveWorkflow(true).catch(console.error);
    state.syncTimer ||= setInterval(() => syncActiveWorkflow(false).catch(console.error), 750);
    api.addEventListener("execution_success", (event) => {
      const enabled = app.extensionManager.setting.get("PromptBookmarks.AutoLinkMedia");
      if (enabled !== false) onExecutionSuccess(event);
    });
  },
});
