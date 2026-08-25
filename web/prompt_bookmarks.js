import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const EXTENSION_NAME = "vdeng.PromptBookmarks";
const API_BASE = "/prompt-bookmarks";
const LANG_SETTING = "PromptBookmarks.Language";
const AUTOLINK_SETTING = "PromptBookmarks.AutoLinkMedia";
const SORT_SETTING = "PromptBookmarks.SortMode";
const AUTOPLAY_SETTING = "PromptBookmarks.PreviewAutoplay";

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
  sort: "recent",
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
    manualPrompt: "＋ 新建",
    manualPromptTitle: "新建提示词",
    manualPromptDesc: "手动输入提示词内容并收藏",
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
    edit: "编辑",
    editPrompt: "编辑提示词",
    promptUpdated: "提示词已更新",
    customCover: "自定义封面图 (可选)",
    uploadCover: "上传封面图...",
    coverUpdated: "封面已更新",
    viewFullscreen: "点击全屏查看",
    notes: "备注 (可选)",
    notesPlaceholder: "添加关于此提示词的备注...",
    saveChanges: "保存修改",
    showAllWidgets: "显示所有控件 (LoRA, 宽高比, 步数等)",
    promptBookmarked: "已收藏提示词",
    duplicatePromptTitle: "已存在同名收藏",
    duplicatePromptDetail: "分组“{group}”中已经有“{name}”。请选择覆盖原收藏，或返回修改名称。",
    overwriteBookmark: "覆盖原收藏",
    renameBookmark: "修改名称",
    promptOverwritten: "已覆盖提示词",
    ungrouped: "未分组",
    apply: "应用",
    copy: "复制",
    delete: "删除",
    deleteConfirm: "删除“{name}”？生成文件不会被删除。",
    deleteGroupConfirm: "删除空分组“{name}”？",
    groupDeleted: "分组已删除",
    renameGroup: "重命名分组",
    renameGroupPrompt: "输入新的分组名称：",
    groupRenamed: "分组已重命名",
    groupNameExists: "已存在同名分组",
    promptApplied: "提示词已应用",
    appliedDetail: "已更新 {applied} 个字段{missing}",
    missingSuffix: "，{count} 个字段未找到",
    copied: "已复制",
    copyFailed: "复制失败",
    mediaCount: "{count} 个预览",
    previewUnavailable: "预览文件已失效",
    sort: "排序",
    sortRecent: "最近使用",
    sortCreated: "最近收藏",
    sortName: "名称",
    sortUsed: "使用次数",
    backup: "备份与恢复",
    exportBackup: "导出 JSON",
    importBackup: "导入 JSON",
    exportDb: "导出数据库 (.db)",
    importDb: "恢复数据库 (.db)",
    importDbConfirm: "恢复 SQLite 数据库？现有的数据库文件将被覆盖并备份为 .db.bak。",
    dbImported: "数据库文件已成功恢复",
    dbLocation: "本地数据库文件: user/prompt_bookmarks/prompt_bookmarks.db",
    backupExported: "备份已导出",
    backupImported: "备份已成功导入",
    importBackupConfirm: "导入备份？同 ID 的收藏会更新，其他现有数据会保留。",
    invalidBackup: "备份文件无效",
    encryption: "密码保护与加密",
    encryptionStatus: "当前状态",
    statusEncrypted: "🔒 已加密 (AES-256-GCM)",
    statusUnencrypted: "🔓 未加密 (明文)",
    enableEncryption: "开启密码加密",
    disableEncryption: "关闭密码保护 (解密)",
    unlockDatabase: "输入密码解锁",
    lockDatabase: "立即锁定",
    enterPassword: "输入密码",
    confirmPassword: "确认密码",
    passwordWarning: "⚠️ 重要提示: 您的密码绝不会保存在磁盘上或上传到任何地方。如果您遗忘了密码，所有已加密的提示词将无法恢复！",
    passwordMismatch: "两次输入的密码不一致",
    passwordTooShort: "密码长度至少需 4 位",
    encryptionEnabledSuccess: "加密成功开启",
    encryptionDisabledSuccess: "密码保护已关闭，数据已解密",
    unlockedSuccess: "数据库已成功解锁",
    previewAutoplay: "视频预览自动播放",
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
    selectAll: "全选",
    clearAll: "清空",
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
    manualPrompt: "＋ New",
    manualPromptTitle: "New Prompt",
    manualPromptDesc: "Manually enter and bookmark prompt fields",
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
    edit: "Edit",
    editPrompt: "Edit Prompt",
    promptUpdated: "Prompt updated",
    customCover: "Custom Cover Image (optional)",
    uploadCover: "Upload Cover Image...",
    coverUpdated: "Cover image updated",
    viewFullscreen: "Click to view fullscreen",
    notes: "Notes (optional)",
    notesPlaceholder: "Add notes about this prompt...",
    saveChanges: "Save Changes",
    showAllWidgets: "Show all widgets (LoRA, aspect ratio, steps, etc.)",
    promptBookmarked: "Prompt bookmarked",
    duplicatePromptTitle: "Bookmark already exists",
    duplicatePromptDetail: "“{name}” already exists in “{group}”. Choose Overwrite to update it, or go back and change the name.",
    overwriteBookmark: "Overwrite",
    renameBookmark: "Change name",
    promptOverwritten: "Prompt overwritten",
    ungrouped: "Ungrouped",
    apply: "Apply",
    copy: "Copy",
    delete: "Delete",
    deleteConfirm: "Delete “{name}”? Generated files will not be deleted.",
    deleteGroupConfirm: "Delete empty group “{name}”?",
    groupDeleted: "Group deleted",
    renameGroup: "Rename group",
    renameGroupPrompt: "Enter a new group name:",
    groupRenamed: "Group renamed",
    groupNameExists: "A group with this name already exists",
    promptApplied: "Prompt applied",
    appliedDetail: "{applied} fields updated{missing}",
    missingSuffix: ", {count} missing",
    copied: "Copied",
    copyFailed: "Copy failed",
    mediaCount: "{count} previews",
    previewUnavailable: "Preview file is no longer available",
    sort: "Sort",
    sortRecent: "Recently used",
    sortCreated: "Recently saved",
    sortName: "Name",
    sortUsed: "Most used",
    backup: "Backup & Restore",
    exportBackup: "Export JSON",
    importBackup: "Import JSON",
    exportDb: "Export Database (.db)",
    importDb: "Restore Database (.db)",
    importDbConfirm: "Restore SQLite database? Current database file will be replaced and backed up as .db.bak.",
    dbImported: "Database file restored successfully",
    dbLocation: "Local database file: user/prompt_bookmarks/prompt_bookmarks.db",
    backupExported: "Backup exported",
    backupImported: "Backup imported successfully",
    importBackupConfirm: "Import this backup? Matching bookmark IDs will be updated and other existing data will be kept.",
    invalidBackup: "Invalid backup file",
    encryption: "Password Protection & Encryption",
    encryptionStatus: "Current Status",
    statusEncrypted: "🔒 Encrypted (AES-256-GCM)",
    statusUnencrypted: "🔓 Unencrypted (Plaintext)",
    enableEncryption: "Enable Password Encryption",
    disableEncryption: "Disable Encryption (Decrypt)",
    unlockDatabase: "Unlock with Password",
    lockDatabase: "Lock Now",
    enterPassword: "Enter Password",
    confirmPassword: "Confirm Password",
    passwordWarning: "⚠️ Important: Your password is NEVER stored on disk or sent anywhere. If you forget your password, your encrypted prompts cannot be recovered!",
    passwordMismatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 4 characters",
    encryptionEnabledSuccess: "Encryption enabled successfully",
    encryptionDisabledSuccess: "Encryption disabled and database decrypted",
    unlockedSuccess: "Database unlocked successfully",
    previewAutoplay: "Autoplay video previews",
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
    selectAll: "Select all",
    clearAll: "Clear all",
    autoLink: "Auto-link generation results",
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
  const langSetting = settings?.[LANG_SETTING];
  if (langSetting) {
    langSetting.name = t("language");
    langSetting.options = [
      { value: "auto", text: t("languageAuto") },
      { value: "zh-CN", text: t("languageZh") },
      { value: "en-US", text: t("languageEn") },
    ];
  }
  const autoLinkSetting = settings?.[AUTOLINK_SETTING];
  if (autoLinkSetting) autoLinkSetting.name = t("autoLink");
  const sortSetting = settings?.[SORT_SETTING];
  if (sortSetting) {
    sortSetting.name = t("sort");
    sortSetting.options = [
      { value: "recent", text: t("sortRecent") },
      { value: "created", text: t("sortCreated") },
      { value: "name", text: t("sortName") },
      { value: "used", text: t("sortUsed") },
    ];
  }
  const autoplaySetting = settings?.[AUTOPLAY_SETTING];
  if (autoplaySetting) autoplaySetting.name = t("previewAutoplay");
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
    .pb-search,.pb-input,.pb-select{width:100%;box-sizing:border-box;}textarea.pb-input{width:100% !important;box-sizing:border-box !important;resize:none !important;border:1px solid var(--border-color);background:var(--comfy-input-bg);color:var(--input-text);border-radius:6px;padding:8px;outline:none}.pb-groups{display:flex;gap:5px;overflow-x:auto}.pb-chip{white-space:nowrap;border-radius:999px;padding:4px 8px;font-size:12px}.pb-group-wrap{display:inline-flex;align-items:center;flex:0 0 auto}.pb-group-wrap .pb-chip{border-radius:999px 0 0 999px}.pb-group-delete{border-left:0!important;border-radius:0 999px 999px 0!important;padding:4px 7px!important;font-size:12px!important;color:#ff7777}.pb-group-edit{flex:0 0 auto;padding:4px 7px!important}
    .pb-body{flex:1;overflow:auto;padding:10px}.pb-empty{color:var(--descrip-text);text-align:center;padding:28px 12px;line-height:1.6}.pb-empty .pb-btn{margin-top:10px}
    .pb-card{border:1px solid var(--border-color);border-radius:9px;overflow:hidden;margin-bottom:10px;background:var(--comfy-input-bg)}.pb-media{width:100%;aspect-ratio:16/9;display:block;object-fit:cover;background:#111}.pb-media-missing{height:160px;display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box;text-align:center;color:var(--descrip-text);background:#111;font-size:12px}.pb-cardbody{padding:9px;display:flex;flex-direction:column;gap:6px}.pb-cardtitle{font-size:14px;font-weight:650}.pb-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--descrip-text)}.pb-badge{border:1px solid var(--border-color);border-radius:5px;padding:1px 5px}.pb-snippet{font-size:12px;line-height:1.45;color:var(--descrip-text);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;word-break:break-word}.pb-actions{display:flex;gap:5px}.pb-actions .pb-btn{flex:1;padding:5px 6px}.pb-danger{color:#ff7777}
    .pb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.52);display:flex;align-items:center;justify-content:center;z-index:100000;padding:18px}.pb-dialog{width:min(680px,95vw);max-height:88vh;display:flex;flex-direction:column;background:var(--comfy-menu-bg);border:1px solid var(--border-color);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.45);color:var(--fg-color);box-sizing:border-box}.pb-dialog-settings{min-width:820px;max-width:920px;width:860px}.pb-dialog-resizable{resize:both;overflow:auto;min-width:680px !important;min-height:520px !important;width:680px;max-width:94vw;max-height:92vh}.pb-dialog-head,.pb-dialog-foot{padding:14px;display:flex;align-items:center;gap:8px}.pb-dialog-head{border-bottom:1px solid var(--border-color)}.pb-dialog-title{font-size:16px;font-weight:700;flex:1}.pb-dialog-body{padding:14px;overflow:auto;display:flex;flex-direction:column;gap:12px;flex:1;height:100%}
    .pb-section-fields { display: flex !important; flex-direction: column !important; flex: 1 1 auto !important; min-height: 120px !important; }
    .pb-field-item-wrap { display: flex !important; flex-direction: column !important; flex: 1 1 auto !important; min-height: 90px !important; margin-bottom: 8px; }
    textarea.pb-field-textarea, .pb-section-fields textarea, .pb-field-item-wrap textarea { width: 100% !important; flex: 1 1 auto !important; height: 100% !important; min-height: 90px !important; box-sizing: border-box !important; resize: none !important; }
.pb-dialog-foot{border-top:1px solid var(--border-color);justify-content:flex-end}.pb-help{font-size:12px;line-height:1.5;color:var(--descrip-text)}.pb-lightbox-overlay{position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100005;backdrop-filter:blur(6px);cursor:zoom-out}.pb-lightbox-close{position:absolute;top:18px;right:24px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:22px;border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}.pb-lightbox-close:hover{background:rgba(239,68,68,.8)}.pb-carousel-container{display:flex;gap:10px;overflow-x:auto;padding:6px 2px 10px 2px;align-items:center}.pb-carousel-item{position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:1px solid var(--border-color);flex:0 0 auto;background:#111}.pb-carousel-item img,.pb-carousel-item video{width:100%;height:100%;object-fit:cover}.pb-carousel-remove{position:absolute;top:3px;right:3px;background:rgba(239,68,68,.9);border:none;color:#fff;font-size:11px;font-weight:bold;width:20px;height:20px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s}.pb-carousel-remove:hover{transform:scale(1.15)}.pb-carousel-add{width:80px;height:80px;border-radius:8px;border:2px dashed var(--border-color);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--descrip-text);font-size:11px;gap:4px;flex:0 0 auto;transition:all .2s;background:rgba(255,255,255,.03)}.pb-carousel-add:hover{border-color:#10b981;color:#10b981;background:rgba(16,185,129,.08)}
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
function openInWindowImageViewer(src, title = "") {
  const overlay = document.createElement("div");
  overlay.className = "pb-lightbox-overlay";

  const closeBtn = document.createElement("button");
  closeBtn.className = "pb-lightbox-close";
  closeBtn.textContent = "✕";
  closeBtn.title = "Close (Esc)";
  const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
  closeBtn.onclick = close;

  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  const isVid = isVideo({ filename: src });
  const mediaEl = isVid ? document.createElement("video") : document.createElement("img");
  mediaEl.src = src;
  mediaEl.style.maxWidth = "92vw";
  mediaEl.style.maxHeight = "88vh";
  mediaEl.style.objectFit = "contain";
  mediaEl.style.borderRadius = "8px";
  mediaEl.style.boxShadow = "0 8px 32px rgba(0,0,0,0.85)";
  mediaEl.style.cursor = "default";
  mediaEl.onclick = (e) => e.stopPropagation();
  if (isVid) {
    mediaEl.controls = true;
    mediaEl.autoplay = true;
  }

  overlay.append(closeBtn, mediaEl);
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.body.appendChild(overlay);
}

function createMediaCarousel(initialMediaList = []) {
  const mediaList = [...initialMediaList];
  const container = document.createElement("div"); container.className = "pb-carousel-container";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*,video/*";
  fileInput.multiple = true;
  fileInput.style.display = "none";

  function renderItems() {
    container.innerHTML = "";
    mediaList.forEach((item, index) => {
      const tile = document.createElement("div"); tile.className = "pb-carousel-item";
      const src = mediaUrl(item);
      const isVid = isVideo(item);
      const el = isVid ? document.createElement("video") : document.createElement("img");
      el.src = src;
      if (isVid) el.muted = true;
      tile.appendChild(el);

      const delBtn = document.createElement("button");
      delBtn.className = "pb-carousel-remove";
      delBtn.textContent = "✕";
      delBtn.title = "Remove image";
      delBtn.onclick = (e) => {
        e.stopPropagation();
        mediaList.splice(index, 1);
        renderItems();
      };
      tile.appendChild(delBtn);
      container.appendChild(tile);
    });

    const addTile = document.createElement("div");
    addTile.className = "pb-carousel-add";
    addTile.innerHTML = `<span style="font-size:18px;line-height:1;">＋</span><span>Add</span>`;
    addTile.onclick = () => fileInput.click();
    container.append(addTile, fileInput);
  }

  fileInput.onchange = async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    for (const file of files) {
      const formData = new FormData();
      formData.append("image", file);
      try {
        const resp = await fetch("/upload/image", { method: "POST", body: formData });
        const res = await resp.json();
        if (res && res.name) {
          mediaList.push({
            filename: res.name,
            subfolder: res.subfolder || "",
            type: res.type || "input",
            media_type: file.type.startsWith("video") ? "video" : "image"
          });
        }
      } catch (err) {
        notify("error", t("title"), `Upload error: ${err.message}`);
      }
    }
    fileInput.value = "";
    renderItems();
  };

  renderItems();
  return { container, getMediaList: () => mediaList };
}

function openDialog(titleText, options = {}) {
  const overlay = document.createElement("div"); overlay.className = "pb-overlay";
  const dialog = document.createElement("div"); dialog.className = "pb-dialog";
  if (options.className) dialog.classList.add(options.className);
  if (options.resizable) {
    dialog.classList.add("pb-dialog-resizable");
    try {
      const saved = JSON.parse(localStorage.getItem("PromptBookmarks.DialogSize") || "null");
      if (saved && saved.width && saved.height) {
        dialog.style.width = `${saved.width}px`;
        dialog.style.height = `${saved.height}px`;
      }
    } catch (_) {}

    new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 280 && height > 280) {
          localStorage.setItem("PromptBookmarks.DialogSize", JSON.stringify({ width: Math.round(width), height: Math.round(height) }));
        }
      }
    }).observe(dialog);
  }
  const head = document.createElement("div"); head.className = "pb-dialog-head";
  const title = document.createElement("div"); title.className = "pb-dialog-title"; title.textContent = titleText;
  const x = button("×", () => overlay.remove()); x.style.fontSize = "18px"; head.append(title, x);
  const body = document.createElement("div"); body.className = "pb-dialog-body";
  const foot = document.createElement("div"); foot.className = "pb-dialog-foot";
  dialog.append(head, body, foot); overlay.appendChild(dialog); document.body.appendChild(overlay);
  overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) overlay.remove(); });
  return { overlay, body, foot, dialog };
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
  return { ...info, id: collisionWorkflowId(info) };
}
function findNode(nodeId) {
  return app.graph?.getNodeById?.(Number.isNaN(Number(nodeId)) ? nodeId : Number(nodeId)) || app.graph?.getNodeById?.(String(nodeId)) || null;
}
function nodeTitle(node) { return String(node?.title || node?.type || node?.comfyClass || "Node"); }
function nodeType(node) { return String(node?.comfyClass || node?.type || node?.constructor?.type || ""); }
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
function bindingKey(node, widgetName) {
  const groupPath = groupPathForNode(node).join("/");
  return [nodeType(node), nodeTitle(node), groupPath, String(widgetName || "")].map((v) => encodeURIComponent(v)).join("|");
}
function resolveLiveField(field) {
  const exactNode = findNode(field.node_id);
  const exactWidget = exactNode?.widgets?.find?.((widget) => widget?.name === field.widget_name);
  if (exactWidget) return { node: exactNode, widget: exactWidget, recovered: false };
  const wantedType = String(field.node_type || "");
  if (!wantedType || !field.widget_name) return null;
  const matches = [];
  for (const node of app.graph?._nodes || []) {
    if (nodeType(node) !== wantedType) continue;
    const widget = node?.widgets?.find?.((item) => item?.name === field.widget_name);
    if (!widget) continue;
    matches.push({ node, widget, key: bindingKey(node, field.widget_name) });
  }
  const storedKey = String(field.binding_key || "");
  if (storedKey) {
    const keyed = matches.filter((item) => item.key === storedKey);
    if (keyed.length === 1) return { node: keyed[0].node, widget: keyed[0].widget, recovered: true };
  }
  if (matches.length !== 1) return null;
  return { node: matches[0].node, widget: matches[0].widget, recovered: true };
}
function promptCandidates(includeAllWidgets = false) {
  const out = [];
  const likely = /(prompt|text|positive|negative|caption|instruction|description|motion|camera|scene|character|lora|aspect|ratio|steps|cfg|denoise)/i;
  const reject = includeAllWidgets
    ? /^(_|control_after_generate|upload)$/i
    : /^(filename|filename_prefix|path|directory|folder|seed|url|model|ckpt|checkpoint)$/i;
  const noteLike = /(note|notes|markdown|sticky)/i;
  for (const node of app.graph?._nodes || []) {
    for (const widget of node.widgets || []) {
      if (!widget?.name) continue;
      const val = widget.value;
      const isSupportedType = includeAllWidgets
        ? (typeof val === "string" || typeof val === "number" || typeof val === "boolean")
        : (typeof val === "string");
      if (!isSupportedType) continue;
      const name = String(widget.name); if (reject.test(name)) continue;
      const title = nodeTitle(node); const type = nodeType(node);
      const groupPath = groupPathForNode(node); const displayPath = [...groupPath, title, name].join(" › ");
      const isNote = noteLike.test(`${title} ${type}`);
      out.push({
        node_id: String(node.id), node_type: type, widget_name: name, binding_key: bindingKey(node, name), label: `${title} · ${name}`,
        display_path: displayPath, group_path: groupPath, preview: String(val ?? ""),
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
function currentField(binding, target) {
  return {
    node_id: String(binding.node_id),
    node_type: String(binding.node_type || nodeType(target.node)),
    widget_name: String(binding.widget_name),
    binding_key: String(binding.binding_key || bindingKey(target.node, binding.widget_name)),
    label: String(binding.label || binding.widget_name),
    value: target.widget.value,
  };
}
function collectCurrentFields() {
  const fields = [];
  for (const binding of state.bindings) {
    const target = resolveLiveField(binding);
    if (target) fields.push(currentField(binding, target));
  }
  return fields;
}

async function configureBindings(includeAll = false) {
  if (!state.workflow) return;
  const candidates = promptCandidates(includeAll);
  if (!candidates.length) return notify("warn", t("noTextWidgets"), t("noTextWidgetsDetail"));
  const existing = new Set(state.bindings.map((b) => `${b.node_id}::${b.widget_name}`));
  const usableExisting = candidates.some((c) => existing.has(`${c.node_id}::${c.widget_name}`));
  const selected = new Set(candidates.filter((c) => !c.note_like && (existing.has(`${c.node_id}::${c.widget_name}`) || (!usableExisting && c.recommended))).map((c) => `${c.node_id}::${c.widget_name}`));
  const dlg = openDialog(t("configureTitle"));
  const help = document.createElement("div"); help.className = "pb-help"; help.textContent = t("configureDesc"); dlg.body.appendChild(help);
  const note = document.createElement("div"); note.className = "pb-help"; note.textContent = t("exposedOnly"); dlg.body.appendChild(note);

  const toggleRow = document.createElement("div"); toggleRow.style.display = "flex"; toggleRow.style.alignItems = "center"; toggleRow.style.gap = "6px"; toggleRow.className = "pb-help";
  const toggleCheck = document.createElement("input"); toggleCheck.type = "checkbox"; toggleCheck.checked = includeAll;
  toggleCheck.onchange = () => { dlg.overlay.remove(); configureBindings(toggleCheck.checked); };
  const toggleLabel = document.createElement("label"); toggleLabel.textContent = t("showAllWidgets"); toggleLabel.style.cursor = "pointer";
  toggleLabel.onclick = () => { toggleCheck.checked = !toggleCheck.checked; dlg.overlay.remove(); configureBindings(toggleCheck.checked); };
  toggleRow.append(toggleCheck, toggleLabel);
  dlg.body.appendChild(toggleRow);

  const countWrap = document.createElement("div"); countWrap.className = "pb-help"; countWrap.style.display = "flex"; countWrap.style.justifyContent = "space-between"; countWrap.style.alignItems = "center";
  const count = document.createElement("div");
  const updateCount = () => { count.textContent = t("selectedCount", { count: selected.size }); }; updateCount();
  const selectActions = document.createElement("div"); selectActions.style.display = "flex"; selectActions.style.gap = "6px";
  const btnSelectAll = button(t("selectAll"), () => {
    for (const c of candidates) selected.add(`${c.node_id}::${c.widget_name}`);
    dlg.body.querySelectorAll(".pb-candidate input[type=checkbox]").forEach((cb) => { cb.checked = true; });
    updateCount();
  });
  btnSelectAll.style.fontSize = "11px"; btnSelectAll.style.padding = "2px 8px";
  const btnClearAll = button(t("clearAll"), () => {
    selected.clear();
    dlg.body.querySelectorAll(".pb-candidate input[type=checkbox]").forEach((cb) => { cb.checked = false; });
    updateCount();
  });
  btnClearAll.style.fontSize = "11px"; btnClearAll.style.padding = "2px 8px";
  selectActions.append(btnSelectAll, btnClearAll);
  countWrap.append(count, selectActions);
  dlg.body.appendChild(countWrap);
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
    const bindings = candidates.filter((c) => selected.has(`${c.node_id}::${c.widget_name}`)).map((c, index) => ({
      node_id: c.node_id, node_type: c.node_type, widget_name: c.widget_name, binding_key: c.binding_key, label: c.label, sort_order: index,
    }));
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

async function findBookmarkConflict(name, groupId) {
  if (!state.workflow) return null;
  const params = new URLSearchParams({ workflow_id: state.workflow.id, q: name, limit: "1000", sort: "created" });
  if (groupId != null) params.set("group_id", String(groupId));
  const rows = await request(`/prompts?${params.toString()}`) || [];
  const normalizedName = String(name || "").trim().toLocaleLowerCase();
  return rows.find((prompt) => {
    if (String(prompt.name || "").trim().toLocaleLowerCase() !== normalizedName) return false;
    if (groupId == null) return prompt.group_id == null;
    return Number(prompt.group_id) === Number(groupId);
  }) || null;
}

function showBookmarkConflict({ existing, cleanedName, groupName, groupId, fields, saveDialog, nameInput }) {
  const dlg = openDialog(t("duplicatePromptTitle"));
  const detail = document.createElement("div"); detail.className = "pb-help";
  detail.textContent = t("duplicatePromptDetail", { name: cleanedName, group: groupName || t("ungrouped") });
  dlg.body.appendChild(detail);
  dlg.foot.append(
    button(t("cancel"), () => dlg.overlay.remove()),
    button(t("renameBookmark"), () => {
      dlg.overlay.remove(); nameInput.focus(); nameInput.select();
    }),
    button(t("overwriteBookmark"), async () => {
      await request(`/prompts/${encodeURIComponent(existing.id)}`, {
        method: "PUT",
        body: JSON.stringify({ name: cleanedName, group_id: groupId, fields }),
      });
      dlg.overlay.remove(); saveDialog.overlay.remove(); await loadData(); notify("success", t("promptOverwritten"), cleanedName);
    }),
  );
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
    const existing = await findBookmarkConflict(cleanedName, groupId);
    if (existing) {
      showBookmarkConflict({ existing, cleanedName, groupName, groupId, fields, saveDialog: dlg, nameInput: name });
      return;
    }
    const created = await request("/prompts", { method: "POST", body: JSON.stringify({ workflow_id: state.workflow.id, group_id: groupId, name: cleanedName, fields, notes: "" }) });
    if (created && created.id) {
      await request(`/prompts/${encodeURIComponent(created.id)}/media`, {
        method: "PUT",
        body: JSON.stringify({ media: carousel.getMediaList() }),
      }).catch(console.error);
    }
    dlg.overlay.remove(); await loadData(); notify("success", t("promptBookmarked"), cleanedName);
  }));
  setTimeout(() => name.focus(), 0);
}

async function manualCreatePrompt() {
  if (!state.workflow) return;
  const bindings = state.bindings;
  if (!bindings || !bindings.length) {
    notify("info", t("configure"), t("saveBeforeBookmark"));
    return configureBindings();
  }
  const dlg = openDialog(t("manualPromptTitle"), { resizable: true });
  const name = document.createElement("input"); name.className = "pb-input"; name.placeholder = t("bookmarkNamePlaceholder"); name.autofocus = true;
  const group = document.createElement("input"); group.className = "pb-input"; group.placeholder = t("groupPlaceholder");
  const carousel = createMediaCarousel([]);
  dlg.body.append(field(t("bookmarkName"), name), field(t("groupOptional"), group), field(t("customCover") || "Images / Media", carousel.container));

  const fieldsSection = document.createElement("div"); fieldsSection.className = "pb-section pb-section-fields";
  const fieldsLabel = document.createElement("div"); fieldsLabel.className = "pb-label"; fieldsLabel.textContent = t("fieldsToSave"); fieldsSection.appendChild(fieldsLabel);
  
  const textareas = [];
  for (const b of bindings) {
    const wrap = document.createElement("div"); wrap.className = "pb-field-item-wrap";
    const lbl = document.createElement("div"); lbl.className = "pb-label"; lbl.style.fontSize = "11px"; lbl.textContent = b.label || b.widget_name;
    const txt = document.createElement("textarea"); txt.className = "pb-input pb-field-textarea"; txt.placeholder = b.widget_name;
    wrap.append(lbl, txt);
    fieldsSection.appendChild(wrap);
    textareas.push({ binding: b, textarea: txt });
  }
  dlg.body.appendChild(fieldsSection);

  dlg.foot.append(button(t("cancel"), () => dlg.overlay.remove()), button(t("createBookmark"), async () => {
    const cleanedName = name.value.trim(); if (!cleanedName) { name.focus(); return; }
    const groupName = group.value.trim(); let groupId = null;
    if (groupName) {
      let found = state.groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
      if (!found) found = await request("/groups", { method: "POST", body: JSON.stringify({ workflow_id: state.workflow.id, name: groupName }) });
      groupId = found.id;
    }
    const fields = textareas.map((item) => ({
      node_id: String(item.binding.node_id),
      node_type: String(item.binding.node_type || ""),
      widget_name: String(item.binding.widget_name),
      binding_key: String(item.binding.binding_key || ""),
      label: String(item.binding.label || item.binding.widget_name),
      value: item.textarea.value,
    }));
    const existing = await findBookmarkConflict(cleanedName, groupId);
    if (existing) {
      showBookmarkConflict({ existing, cleanedName, groupName, groupId, fields, saveDialog: dlg, nameInput: name });
      return;
    }
    const created = await request("/prompts", { method: "POST", body: JSON.stringify({ workflow_id: state.workflow.id, group_id: groupId, name: cleanedName, fields, notes: "" }) });
    if (created && created.id) {
      await request(`/prompts/${encodeURIComponent(created.id)}/media`, {
        method: "PUT",
        body: JSON.stringify({ media: carousel.getMediaList() }),
      }).catch(console.error);
    }
    dlg.overlay.remove(); await loadData(); notify("success", t("promptBookmarked"), cleanedName);
  }));
  setTimeout(() => name.focus(), 0);
}

async function editPrompt(prompt) {
  const dlg = openDialog(t("editPrompt"), { resizable: true });
  const name = document.createElement("input"); name.className = "pb-input"; name.value = prompt.name || "";
  const group = document.createElement("input"); group.className = "pb-input"; group.value = prompt.group_name || ""; group.placeholder = t("groupPlaceholder");
  const notes = document.createElement("input"); notes.className = "pb-input"; notes.value = prompt.notes || ""; notes.placeholder = t("notesPlaceholder");

  dlg.body.append(
    field(t("bookmarkName"), name),
    field(t("groupOptional"), group),
    field(t("notes"), notes),
  );

  const existingMedia = (prompt.media && prompt.media.length)
    ? prompt.media
    : (prompt.latest_media ? [prompt.latest_media] : []);
  const carousel = createMediaCarousel(existingMedia);
  dlg.body.append(field(t("customCover") || "Images / Media", carousel.container));

  const fieldsSection = document.createElement("div"); fieldsSection.className = "pb-section pb-section-fields";
  const fieldsLabel = document.createElement("div"); fieldsLabel.className = "pb-label"; fieldsLabel.textContent = t("fieldsToSave"); fieldsSection.appendChild(fieldsLabel);

  const textareas = [];
  for (const f of prompt.fields || []) {
    const wrap = document.createElement("div"); wrap.className = "pb-field-item-wrap";
    const lbl = document.createElement("div"); lbl.className = "pb-label"; lbl.style.fontSize = "11px"; lbl.textContent = f.label || f.widget_name;
    const txt = document.createElement("textarea"); txt.className = "pb-input pb-field-textarea"; txt.value = String(f.value ?? "");
    wrap.append(lbl, txt);
    fieldsSection.appendChild(wrap);
    textareas.push({ field: f, textarea: txt });
  }
  dlg.body.appendChild(fieldsSection);

  dlg.foot.append(button(t("cancel"), () => dlg.overlay.remove()), button(t("saveChanges"), async () => {
    const cleanedName = name.value.trim(); if (!cleanedName) { name.focus(); return; }
    const groupName = group.value.trim(); let groupId = null;
    if (groupName) {
      let found = (state.groups || []).find((g) => g.name.toLowerCase() === groupName.toLowerCase());
      if (!found && state.workflow) found = await request("/groups", { method: "POST", body: JSON.stringify({ workflow_id: state.workflow.id, name: groupName }) });
      groupId = found ? found.id : null;
    }
    const updatedFields = textareas.map((item) => ({
      ...item.field,
      value: item.textarea.value,
    }));
    await request(`/prompts/${encodeURIComponent(prompt.id)}`, {
      method: "PUT",
      body: JSON.stringify({
        name: cleanedName,
        group_id: groupId,
        notes: notes.value.trim(),
        fields: updatedFields,
      }),
    });
    await request(`/prompts/${encodeURIComponent(prompt.id)}/media`, {
      method: "PUT",
      body: JSON.stringify({ media: carousel.getMediaList() }),
    }).catch(console.error);
    dlg.overlay.remove(); await loadData(); notify("success", t("promptUpdated"), cleanedName);
  }));
}

function applyPrompt(prompt) {
  let applied = 0; const missing = [];
  for (const field of prompt.fields || []) {
    const target = resolveLiveField(field);
    if (!target) { missing.push(field.label || field.widget_name); continue; }
    target.widget.value = field.value;
    target.widget.callback?.(field.value, app.canvas, target.node, target.widget);
    target.node.setDirtyCanvas?.(true, true); applied += 1;
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
  await request(`/prompts/${encodeURIComponent(prompt.id)}`, { method: "DELETE" });
  if (state.workflow) state.groups = await request(`/groups?workflow_id=${encodeURIComponent(state.workflow.id)}`) || [];
  await loadPrompts();
}
function mediaUrl(media) { const q = new URLSearchParams({ filename: media.filename || "", subfolder: media.subfolder || "", type: media.type || "output" }); return `/view?${q.toString()}`; }
function isVideo(media) { return media?.media_type === "video" || /\.(mp4|webm|mov|mkv|m4v)$/i.test(media?.filename || ""); }

async function loadPrompts() {
  try {
    state.encryptionStatus = await request("/encryption/status");
  } catch (_) {}
  if (!state.workflow && !state.allMode) { state.prompts = []; state.allGroups = []; render(); return; }
  const params = new URLSearchParams({ limit: "500", sort: state.sort || "recent" });
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

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function exportBackup() {
  const data = await request("/backup");
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJson(`prompt-bookmarks-${stamp}.json`, data);
  notify("success", t("backupExported"));
}
async function importBackup() {
  const input = document.createElement("input"); input.type = "file"; input.accept = "application/json,.json";
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (_) { notify("error", t("title"), t("invalidBackup")); return; }
    if (!window.confirm(t("importBackupConfirm"))) return;
    try {
      await request("/backup/import", { method: "POST", body: JSON.stringify(data) });
      if (state.workflow) await loadData(); else await loadPrompts();
      notify("success", t("backupImported"));
    } catch (err) { notify("error", t("title"), String(err?.message || err)); }
  };
  input.click();
}

function exportDbFile() {
  window.open("/prompt-bookmarks/db/file", "_blank");
  notify("success", t("backupExported"));
}
function importDbFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".db,application/octet-stream";
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    if (!window.confirm(t("importDbConfirm"))) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const resp = await fetch("/prompt-bookmarks/db/file", { method: "POST", body: formData });
      const data = await resp.json();
      if (data && data.ok) {
        notify("success", t("dbImported"));
        if (state.workflow) await loadData(); else await loadPrompts();
      } else {
        throw new Error(data?.error || "Failed to restore database");
      }
    } catch (err) {
      notify("error", t("title"), String(err?.message || err));
    }
  };
  input.click();
}

async function openEnableEncryptionDialog(onDone) {
  const dlg = openDialog(t("enableEncryption"));
  const warn = document.createElement("div"); warn.className = "pb-help"; warn.style.color = "#fbbf24"; warn.style.fontWeight = "bold"; warn.style.marginBottom = "10px"; warn.textContent = t("passwordWarning");
  const pass1 = document.createElement("input"); pass1.type = "password"; pass1.className = "pb-input"; pass1.placeholder = t("enterPassword");
  const pass2 = document.createElement("input"); pass2.type = "password"; pass2.className = "pb-input"; pass2.placeholder = t("confirmPassword");
  dlg.body.append(warn, field(t("enterPassword"), pass1), field(t("confirmPassword"), pass2));
  dlg.foot.append(button(t("cancel"), () => dlg.overlay.remove()), button(t("saveChanges"), async () => {
    const p1 = pass1.value; const p2 = pass2.value;
    if (!p1 || p1.length < 4) { alert(t("passwordTooShort")); pass1.focus(); return; }
    if (p1 !== p2) { alert(t("passwordMismatch")); pass2.focus(); return; }
    try {
      await request("/encryption/enable", { method: "POST", body: JSON.stringify({ password: p1, algorithm: "AES-256-GCM" }) });
      dlg.overlay.remove();
      notify("success", t("encryptionEnabledSuccess"));
      if (onDone) onDone();
      await loadPrompts();
    } catch (err) {
      alert(String(err?.message || err));
    }
  }));
}

async function openDisableEncryptionDialog(onDone) {
  const dlg = openDialog(t("disableEncryption"));
  const pass = document.createElement("input"); pass.type = "password"; pass.className = "pb-input"; pass.placeholder = t("enterPassword");
  dlg.body.append(field(t("enterPassword"), pass));
  dlg.foot.append(button(t("cancel"), () => dlg.overlay.remove()), button(t("disableEncryption"), async () => {
    const p = pass.value; if (!p) { pass.focus(); return; }
    try {
      await request("/encryption/disable", { method: "POST", body: JSON.stringify({ password: p }) });
      dlg.overlay.remove();
      notify("success", t("encryptionDisabledSuccess"));
      if (onDone) onDone();
      await loadPrompts();
    } catch (err) {
      alert(String(err?.message || err));
    }
  }));
}

async function openUnlockDialog(onDone) {
  const dlg = openDialog(t("unlockDatabase"));
  const pass = document.createElement("input"); pass.type = "password"; pass.className = "pb-input"; pass.placeholder = t("enterPassword");
  dlg.body.append(field(t("enterPassword"), pass));
  dlg.foot.append(button(t("cancel"), () => dlg.overlay.remove()), button(t("unlockDatabase"), async () => {
    const p = pass.value; if (!p) { pass.focus(); return; }
    try {
      await request("/encryption/unlock", { method: "POST", body: JSON.stringify({ password: p }) });
      dlg.overlay.remove();
      notify("success", t("unlockedSuccess"));
      if (onDone) onDone();
      await loadPrompts();
    } catch (err) {
      alert(String(err?.message || err));
    }
  }));
}

async function showSettings() {
  const dlg = openDialog(t("settings"), { className: "pb-dialog-settings" });
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

  const sortRow = document.createElement("div"); sortRow.className = "pb-settings-row";
  const sortText = document.createElement("div"); sortText.textContent = t("sort");
  const sortSelect = document.createElement("select"); sortSelect.className = "pb-select";
  for (const [value, label] of [["recent", t("sortRecent")], ["created", t("sortCreated")], ["name", t("sortName")], ["used", t("sortUsed")]]) {
    const option = document.createElement("option"); option.value = value; option.textContent = label; sortSelect.appendChild(option);
  }
  sortSelect.value = state.sort || settingGet(SORT_SETTING, "recent");
  sortSelect.onchange = async () => { state.sort = sortSelect.value; await app.extensionManager?.setting?.set?.(SORT_SETTING, state.sort); await loadPrompts(); };
  sortRow.append(sortText, sortSelect); dlg.body.appendChild(sortRow);

  const autoplayRow = document.createElement("div"); autoplayRow.className = "pb-settings-row";
  const autoplayText = document.createElement("div"); autoplayText.textContent = t("previewAutoplay");
  const autoplay = document.createElement("input"); autoplay.type = "checkbox"; autoplay.checked = settingGet(AUTOPLAY_SETTING, false) === true;
  autoplay.onchange = async () => { await app.extensionManager?.setting?.set?.(AUTOPLAY_SETTING, autoplay.checked); window.dispatchEvent(new CustomEvent("prompt-bookmarks-autoplay-changed")); };
  autoplayRow.append(autoplayText, autoplay); dlg.body.appendChild(autoplayRow);

  // Encryption status & controls
  const encStatus = await request("/encryption/status").catch(() => ({ enabled: false, unlocked: true }));
  const encRow = document.createElement("div"); encRow.className = "pb-settings-row";
  const encInfo = document.createElement("div");
  encInfo.innerHTML = `<div>${t("encryption")}</div><div class="pb-help">${encStatus.enabled ? t("statusEncrypted") : t("statusUnencrypted")}</div>`;
  const encActions = document.createElement("div"); encActions.className = "pb-row"; encActions.style.gap = "4px";
  if (!encStatus.enabled) {
    encActions.appendChild(button(t("enableEncryption"), () => { dlg.overlay.remove(); openEnableEncryptionDialog(showSettings); }));
  } else if (!encStatus.unlocked) {
    encActions.append(
      button(t("unlockDatabase"), () => { dlg.overlay.remove(); openUnlockDialog(showSettings); }),
      button(t("disableEncryption"), () => { dlg.overlay.remove(); openDisableEncryptionDialog(showSettings); }, "pb-danger")
    );
  } else {
    encActions.append(
      button(t("lockDatabase"), async () => { await request("/encryption/lock", { method: "POST" }); dlg.overlay.remove(); showSettings(); await loadPrompts(); }),
      button(t("disableEncryption"), () => { dlg.overlay.remove(); openDisableEncryptionDialog(showSettings); }, "pb-danger")
    );
  }
  encRow.append(encInfo, encActions);
  dlg.body.appendChild(encRow);

  // Backup & Restore
  const backupRow = document.createElement("div"); backupRow.className = "pb-settings-row";
  const backupText = document.createElement("div"); backupText.textContent = t("backup");
  const backupActions = document.createElement("div"); backupActions.className = "pb-row"; backupActions.style.gap = "4px";
  backupActions.append(
    button(t("exportBackup"), exportBackup),
    button(t("importBackup"), importBackup),
    button(t("exportDb"), exportDbFile),
    button(t("importDb"), importDbFile)
  );
  backupRow.append(backupText, backupActions); dlg.body.appendChild(backupRow);

  const dbNote = document.createElement("div"); dbNote.className = "pb-help"; dbNote.textContent = t("dbLocation"); dlg.body.appendChild(dbNote);

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
    const media = isVideo(prompt.latest_media) ? document.createElement("video") : document.createElement("img");
    media.className = "pb-media";
    const src = mediaUrl(prompt.latest_media);
    if (media.tagName === "VIDEO") media.dataset.pbSrc = src; else media.src = src;
    media.addEventListener("error", () => {
      if (!media.isConnected) return;
      const missing = document.createElement("div"); missing.className = "pb-media-missing"; missing.textContent = t("previewUnavailable");
      media.replaceWith(missing);
    }, { once: true });
    if (media.tagName === "VIDEO") { media.controls = true; media.muted = true; media.preload = "none"; } else media.loading = "lazy";
    media.style.cursor = "zoom-in";
    media.title = t("viewFullscreen");
    media.onclick = (e) => {
      e.stopPropagation();
      openInWindowImageViewer(src, prompt.name);
    };
    card.appendChild(media);
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
  actions.append(
    apply,
    button(t("copy"), () => copyPrompt(prompt)),
    button(t("edit"), () => editPrompt(prompt)),
    button(t("delete"), () => deletePrompt(prompt), "pb-danger")
  );
  body.appendChild(actions); card.appendChild(body); return card;
}
async function renameSelectedGroup() {
  const group = (state.groups || []).find((item) => item.id === state.groupId);
  if (!group) return;
  const value = window.prompt(t("renameGroupPrompt"), group.name);
  if (value == null) return;
  const cleaned = value.trim();
  if (!cleaned || cleaned === group.name) return;
  if ((state.groups || []).some((item) => item.id !== group.id && String(item.name || "").toLowerCase() === cleaned.toLowerCase())) {
    notify("warn", t("renameGroup"), t("groupNameExists")); return;
  }
  await request(`/groups/${encodeURIComponent(group.id)}`, { method: "PUT", body: JSON.stringify({ name: cleaned }) });
  await loadData(); notify("success", t("groupRenamed"), cleaned);
}
async function deleteGroup(group) {
  if (Number(group?.prompt_count || 0) !== 0) return;
  if (!window.confirm(t("deleteGroupConfirm", { name: group.name }))) return;
  await request(`/groups/${encodeURIComponent(group.id)}`, { method: "DELETE" });
  if (state.groupId === group.id) state.groupId = null;
  await loadData(); notify("success", t("groupDeleted"), group.name);
}
function renderGroupFilters(head) {
  const groups = document.createElement("div"); groups.className = "pb-groups";
  if (state.allMode) {
    groups.appendChild(button(t("all"), async () => { state.allGroupName = null; await loadPrompts(); }, `pb-chip ${state.allGroupName == null ? "active" : ""}`));
    for (const name of state.allGroups) groups.appendChild(button(name, async () => { state.allGroupName = name; await loadPrompts(); }, `pb-chip ${state.allGroupName === name ? "active" : ""}`));
  } else if (state.workflow) {
    groups.appendChild(button(t("all"), async () => { state.groupId = null; await loadPrompts(); }, `pb-chip ${state.groupId == null ? "active" : ""}`));
    for (const g of state.groups || []) {
      if (Number(g.prompt_count || 0) === 0) {
        const wrap = document.createElement("div"); wrap.className = "pb-group-wrap";
        wrap.append(
          button(g.name, async () => { state.groupId = g.id; await loadPrompts(); }, `pb-chip ${state.groupId === g.id ? "active" : ""}`),
          button("×", () => deleteGroup(g), "pb-group-delete"),
        );
        groups.appendChild(wrap);
      } else groups.appendChild(button(g.name, async () => { state.groupId = g.id; await loadPrompts(); }, `pb-chip ${state.groupId === g.id ? "active" : ""}`));
    }
    if (state.groupId != null) { const edit = button("✎", renameSelectedGroup, "pb-chip pb-group-edit"); edit.title = t("renameGroup"); groups.appendChild(edit); }
  }
  if (groups.childElementCount) head.appendChild(groups);
}
function render() {
  if (!state.root) return; state.root.replaceChildren();
  const head = document.createElement("div"); head.className = "pb-head";
  const top = document.createElement("div"); top.className = "pb-row";
  const title = document.createElement("div"); title.className = "pb-title"; title.textContent = t("title");
  if (state.encryptionStatus?.enabled && state.encryptionStatus?.unlocked) {
    const lockBtn = button("🔒 " + (t("lock") || "Lock"), async () => {
      await request("/encryption/lock", { method: "POST" });
      state.encryptionStatus = await request("/encryption/status").catch(() => null);
      await loadPrompts();
      render();
      notify("info", t("title"), "Database locked");
    });
    lockBtn.style.padding = "2px 8px"; lockBtn.style.fontSize = "11px";
    top.append(title, lockBtn, button("⚙", showSettings));
  } else {
    top.append(title, button("⚙", showSettings));
  }
  head.appendChild(top);

  if (state.encryptionStatus?.enabled && !state.encryptionStatus?.unlocked) {
    const encWrap = document.createElement("div");
    encWrap.style.cssText = "display:flex;gap:6px;align-items:center;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:6px 8px;margin-bottom:4px;";
    const passInput = document.createElement("input");
    passInput.type = "password"; passInput.className = "pb-input";
    passInput.style.cssText = "flex:1;padding:5px 8px;font-size:12px;";
    passInput.placeholder = t("enterPassword") || "Enter master password...";
    const unlockBtn = button("🔓 " + (t("unlock") || "Unlock"), async () => {
      const p = passInput.value; if (!p) { passInput.focus(); return; }
      try {
        await request("/encryption/unlock", { method: "POST", body: JSON.stringify({ password: p }) });
        notify("success", t("unlockedSuccess"));
        state.encryptionStatus = await request("/encryption/status").catch(() => null);
        await loadPrompts();
        render();
      } catch (e) {
        notify("error", t("title"), String(e.message || e));
      }
    });
    unlockBtn.style.padding = "5px 10px"; unlockBtn.style.fontSize = "12px";
    passInput.onkeydown = (e) => { if (e.key === "Enter") unlockBtn.click(); };
    encWrap.append(passInput, unlockBtn);
    head.appendChild(encWrap);
  }
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
  const btnRow = document.createElement("div"); btnRow.style.display = "flex"; btnRow.style.gap = "6px";
  const save = button(t("saveCurrent"), saveCurrentPrompt); save.disabled = !state.workflow; save.style.flex = "1";
  const manual = button(t("manualPrompt"), manualCreatePrompt); manual.disabled = !state.workflow; manual.title = t("manualPromptDesc");
  btnRow.append(save, manual);
  head.appendChild(btnRow);
  state.root.appendChild(head);
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
  const p = history?.prompt;
  if (Array.isArray(p)) return p[2] && typeof p[2] === "object" ? p[2] : {};
  if (p?.prompt && typeof p.prompt === "object") return p.prompt;
  return {};
}
function extractWorkflowSnapshot(history) {
  const p = history?.prompt;
  if (Array.isArray(p)) return p?.[3]?.extra_pnginfo?.workflow || p?.[3]?.workflow || null;
  return p?.extra_data?.extra_pnginfo?.workflow || history?.extra_data?.extra_pnginfo?.workflow || history?.workflow?.extra_data?.extra_pnginfo?.workflow || null;
}
function extractWorkflowSourceId(history) {
  if (history?.workflow_id) return String(history.workflow_id);
  const snapshot = extractWorkflowSnapshot(history);
  if (snapshot?.id) return String(snapshot.id);
  const p = history?.prompt;
  if (Array.isArray(p)) return String(p?.[3]?.workflow_id || "") || null;
  return String(p?.extra_data?.workflow_id || "") || null;
}
async function resolveHistoryWorkflowId(history) {
  const sourceId = extractWorkflowSourceId(history);
  if (!sourceId) return state.workflow?.id || null;
  if (state.workflow?.sourceId === sourceId) return state.workflow.id;
  return sourceId;
}
function unwrapPromptValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "__value__")) return value.__value__;
  return value;
}
function snapshotNodeForBinding(workflow, binding) {
  const exact = workflow?.nodes?.find?.((node) => String(node?.id) === String(binding.node_id));
  if (exact) return exact;
  const wantedType = String(binding.node_type || "");
  if (!wantedType) return null;
  const matches = (workflow?.nodes || []).filter((node) => String(node?.type || node?.class_type || "") === wantedType);
  return matches.length === 1 ? matches[0] : null;
}
function workflowSnapshotValue(history, binding) {
  const workflow = extractWorkflowSnapshot(history);
  const workflowNode = snapshotNodeForBinding(workflow, binding);
  const values = workflowNode?.widgets_values;
  if (!Array.isArray(values) || !values.length) return { found: false, value: undefined };
  let widgetIndex = Number(binding.widget_index ?? -1);
  if (!Number.isInteger(widgetIndex) || widgetIndex < 0 || widgetIndex >= values.length) {
    const liveNode = resolveLiveField(binding)?.node || null;
    const liveIndex = liveNode?.widgets?.findIndex?.((widget) => widget?.name === binding.widget_name) ?? -1;
    if (liveIndex >= 0 && liveIndex < values.length) widgetIndex = liveIndex;
  }
  if ((!Number.isInteger(widgetIndex) || widgetIndex < 0 || widgetIndex >= values.length) && values.length === 1) widgetIndex = 0;
  if (!Number.isInteger(widgetIndex) || widgetIndex < 0 || widgetIndex >= values.length) return { found: false, value: undefined };
  return { found: true, value: values[widgetIndex] };
}
function historyNodeForBinding(graph, binding) {
  const exact = graph?.[String(binding.node_id)];
  if (exact?.inputs && Object.prototype.hasOwnProperty.call(exact.inputs, binding.widget_name)) return exact;
  const wantedType = String(binding.node_type || "");
  if (!wantedType) return exact || null;
  const matches = Object.values(graph || {}).filter((node) => String(node?.class_type || "") === wantedType && node?.inputs && Object.prototype.hasOwnProperty.call(node.inputs, binding.widget_name));
  return matches.length === 1 ? matches[0] : exact || null;
}
function fieldsFromHistory(history, bindings) {
  const graph = extractPromptGraph(history); const fields = [];
  for (const b of bindings) {
    const node = historyNodeForBinding(graph, b);
    let found = false; let value;
    if (node?.inputs && Object.prototype.hasOwnProperty.call(node.inputs, b.widget_name)) {
      const input = node.inputs[b.widget_name];
      if (!(Array.isArray(input) && input.length === 2)) { value = unwrapPromptValue(input); found = true; }
    }
    if (!found) { const snapshot = workflowSnapshotValue(history, b); if (snapshot.found) { value = snapshot.value; found = true; } }
    if (!found) continue;
    fields.push({ node_id: String(b.node_id), node_type: String(b.node_type || node?.class_type || ""), widget_name: String(b.widget_name), binding_key: String(b.binding_key || ""), label: String(b.label || b.widget_name), value });
  }
  return fields;
}
function addLiveFieldFallback(fields, bindings, workflowId) {
  if (state.workflow?.id !== workflowId || fields.length >= bindings.length) return fields;
  const keys = new Set(fields.map((field) => `${field.node_id}::${field.widget_name}`));
  for (const b of bindings) {
    const key = `${b.node_id}::${b.widget_name}`; if (keys.has(key)) continue;
    const target = resolveLiveField(b); if (!target) continue;
    fields.push(currentField(b, target)); keys.add(key);
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
    const history = await historyWithRetry(String(promptId));
    if (!history) { console.debug("[Prompt Bookmarks] media auto-link: history unavailable", { promptId }); return; }
    const workflowId = await resolveHistoryWorkflowId(history);
    if (!workflowId) { console.debug("[Prompt Bookmarks] media auto-link: workflow unresolved", { promptId }); return; }
    const bindings = await request(`/bindings?workflow_id=${encodeURIComponent(workflowId)}`);
    if (!bindings?.length) { console.debug("[Prompt Bookmarks] media auto-link: no bindings", { promptId, workflowId }); return; }
    let fields = fieldsFromHistory(history, bindings);
    fields = addLiveFieldFallback(fields, bindings, workflowId);
    const media = collectMedia(history.outputs);
    if (!fields.length) { console.debug("[Prompt Bookmarks] media auto-link: no prompt fields recovered", { promptId, workflowId, bindingCount: bindings.length }); return; }
    if (!media.length) { console.debug("[Prompt Bookmarks] media auto-link: no media outputs found", { promptId, workflowId, outputKeys: Object.keys(history.outputs || {}) }); return; }
    if (fields.length !== bindings.length) console.debug("[Prompt Bookmarks] media auto-link: partial field recovery", { promptId, workflowId, recovered: fields.length, expected: bindings.length });
    const result = await request("/media/link", { method: "POST", body: JSON.stringify({ workflow_id: workflowId, fields, execution_id: String(promptId), media }) });
    if (result?.linked_prompt_ids?.length) {
      console.debug("[Prompt Bookmarks] media auto-link: linked", { promptId, workflowId, promptIds: result.linked_prompt_ids, mediaCount: media.length });
      if (state.workflow?.id === workflowId) await loadPrompts();
    } else console.debug("[Prompt Bookmarks] media auto-link: no saved prompt fingerprint matched", { promptId, workflowId, fieldCount: fields.length, mediaCount: media.length });
  } catch (err) { console.warn("[Prompt Bookmarks] media auto-link failed", err); }
}

app.registerExtension({
  name: EXTENSION_NAME,
  settings: [
    {
      id: LANG_SETTING,
      name: "Language",
      type: "combo",
      options: [{ value: "auto", text: "Auto" }, { value: "zh-CN", text: "简体中文" }, { value: "en-US", text: "English" }],
      defaultValue: "auto",
      onChange: () => setTimeout(() => { refreshExtensionLabels(); render(); }, 0),
    },
    { id: AUTOLINK_SETTING, name: "Automatically link generated media", type: "boolean", defaultValue: true },
    {
      id: SORT_SETTING,
      name: "Sort",
      type: "combo",
      options: [{ value: "recent", text: "Recently used" }, { value: "created", text: "Recently saved" }, { value: "name", text: "Name" }, { value: "used", text: "Most used" }],
      defaultValue: "recent",
      onChange: () => setTimeout(() => { state.sort = settingGet(SORT_SETTING, "recent") || "recent"; if (state.root) loadPrompts().catch(console.error); }, 0),
    },
    {
      id: AUTOPLAY_SETTING,
      name: "Autoplay video previews",
      type: "boolean",
      defaultValue: false,
      onChange: () => setTimeout(() => window.dispatchEvent(new CustomEvent("prompt-bookmarks-autoplay-changed")), 0),
    },
  ],
  async setup() {
    state.sort = settingGet(SORT_SETTING, "recent") || "recent";
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
