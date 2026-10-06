const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, children = []) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === "class" ? n.className = v : k === "text" ? n.textContent = v : n.setAttribute(k, v));
  children.forEach((c) => n.append(c));
  return n;
};
let me = null;
let pendingFiles = [];

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || `通信に失敗しました (${response.status})`);
  return data;
}

function showStatus(node, message, isError = false) {
  node.textContent = message;
  node.classList.toggle("err", isError);
}

function enterApp(user) {
  me = user;
  $("#login-view").classList.add("hide");
  $("#app").classList.remove("hide");
  $("#login-open").classList.add("hide");
  $("#logout").classList.remove("hide");
  $("#who").textContent = `${user.displayName} · ${user.role === "admin" ? "管理者" : user.role === "editor" ? "編集者" : "社員"}`;
  $("#new-manual").classList.toggle("hide", !["admin", "editor"].includes(user.role));
  $("#users-section").classList.toggle("hide", user.role !== "admin");
  loadManuals();
  if (user.role === "admin") loadUsers();
}

async function init() {
  try {
    const { user } = await api("/api/auth/me");
    enterApp(user);
  } catch (error) {
    $("#login-view").classList.remove("hide");
    $("#app").classList.add("hide");
    if (error.message.includes("登録")) showStatus($("#login-status"), error.message, true);
  }
}

$("#login-open").addEventListener("click", () => { window.location.assign("/"); });
$("#logout").addEventListener("click", () => { window.location.assign("/cdn-cgi/access/logout"); });

async function loadManuals() {
  const root = $("#manual-list");
  root.replaceChildren(el("div", { class: "empty", text: "マニュアルを読み込み中…" }));
  try {
    const { manuals } = await api("/api/manuals");
    root.replaceChildren();
    if (!manuals.length) {
      root.append(el("div", { class: "box empty", text: "まだマニュアルが登録されていません。管理者・編集者が最初の手順を追加できます。" }));
      return;
    }
    manuals.forEach((manual) => {
      const card = el("article", { class: "card" });
      const top = el("div", { class: "bar" });
      const title = el("h3", { class: "heading", text: manual.title });
      const button = el("button", { class: "secondary tiny", text: "詳細を見る" });
      top.append(title, button);
      card.append(top, el("div", { class: "manualmeta", text: `${manual.category} · 更新 ${new Date(manual.updatedAt).toLocaleDateString("ja-JP")}` }), el("p", { text: manual.summary }));
      const details = el("div", { class: "hide" });
      const body = el("p");
      body.style.whiteSpace = "pre-wrap";
      body.textContent = manual.body || "本文はありません。添付資料を確認してください。";
      details.append(body);
      if (manual.steps?.length) {
        const list = el("ol");
        manual.steps.forEach((step) => list.append(el("li", { text: step })));
        details.append(list);
      }
      if (manual.caution) details.append(el("p", { class: "hint", text: `注意：${manual.caution}` }));
      if (manual.attachments?.length) {
        const files = el("div", { class: "attachments" });
        manual.attachments.forEach((file) => files.append(el("a", { class: "attachment", href: `/api/files/${encodeURIComponent(file.id)}`, target: "_blank", rel: "noopener", text: `📎 ${file.name}を開く` })));
        details.append(files);
      }
      card.append(details);
      button.addEventListener("click", () => {
        const opening = details.classList.contains("hide");
        details.classList.toggle("hide");
        button.textContent = opening ? "閉じる" : "詳細を見る";
      });
      root.append(card);
    });
  } catch (error) { root.replaceChildren(el("div", { class: "box empty", text: error.message })); }
}

$("#ask-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const area = $("#answer-area");
  area.classList.remove("hide");
  area.replaceChildren(el("p", { class: "hint", text: "関連する手順を検索しています…" }));
  try {
    const result = await api("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: $("#query").value }) });
    area.replaceChildren(el("h2", { class: "heading", text: "回答" }), el("div", { class: "answer", text: result.answer }));
    if (!result.sources.length) {
      area.append(el("p", { class: "hint", text: "該当する手順がありません。言葉を変えて検索するか、管理者に登録を相談してください。" }));
      return;
    }
    area.append(el("h3", { class: "heading", text: "参照したマニュアル" }));
    result.sources.forEach((source) => {
      const card = el("div", { class: "source" });
      card.append(el("span", { class: "pill", text: source.category }), el("h3", { text: source.title }), el("p", { text: source.excerpt }));
      if (source.attachments?.length) {
        const files = el("div", { class: "attachments" });
        source.attachments.forEach((file) => files.append(el("a", { class: "attachment", href: `/api/files/${encodeURIComponent(file.id)}`, target: "_blank", rel: "noopener", text: `📎 ${file.name}` })));
        card.append(files);
      }
      area.append(card);
    });
  } catch (error) { area.replaceChildren(el("p", { class: "status err", text: error.message })); }
});

$("#new-manual").addEventListener("click", () => $("#manual-modal").classList.remove("hide"));
$("#new-user").addEventListener("click", () => $("#user-modal").classList.remove("hide"));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.close}`).classList.add("hide")));

function drawFiles() {
  const box = $("#file-list");
  box.replaceChildren();
  pendingFiles.forEach((file, index) => {
    const item = el("span", { class: "attachment", text: `${file.name} (${Math.ceil(file.size / 1024)} KB) ` });
    const remove = el("button", { class: "tiny danger", type: "button", text: "外す" });
    remove.addEventListener("click", () => { pendingFiles.splice(index, 1); drawFiles(); });
    item.append(remove);
    box.append(item);
  });
}

function addFiles(files) {
  for (const file of files) {
    if (file.size > 15 * 1024 * 1024) { showStatus($("#manual-status"), `${file.name}: 1ファイル15MBまでです。`, true); continue; }
    if (!pendingFiles.some((item) => item.name === file.name && item.size === file.size)) pendingFiles.push(file);
    if (/\.(txt|md|csv)$/i.test(file.name)) file.text().then((text) => { $("#m-body").value += `${$("#m-body").value ? "\n\n" : ""}${text}`; });
  }
  drawFiles();
}

$("#m-files").addEventListener("change", (event) => addFiles([...event.target.files]));
$("#dropzone").addEventListener("dragover", (event) => { event.preventDefault(); event.currentTarget.style.background = "#e8f7f5"; });
$("#dropzone").addEventListener("dragleave", (event) => { event.currentTarget.style.background = ""; });
$("#dropzone").addEventListener("drop", (event) => { event.preventDefault(); event.currentTarget.style.background = ""; addFiles([...event.dataTransfer.files]); });
$("#m-body").addEventListener("paste", (event) => {
  const images = [...event.clipboardData.items].filter((item) => item.kind === "file").map((item) => item.getAsFile()).filter(Boolean);
  if (images.length) { event.preventDefault(); addFiles(images); }
});

$("#manual-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus($("#manual-status"), "登録しています…");
  const form = new FormData();
  for (const [key, id] of Object.entries({ title: "m-title", category: "m-category", summary: "m-summary", keywords: "m-keywords", body: "m-body", caution: "m-caution" })) form.append(key, $(`#${id}`).value);
  pendingFiles.forEach((file) => form.append("files", file, file.name));
  try {
    await api("/api/manuals", { method: "POST", body: form });
    showStatus($("#manual-status"), "マニュアルを共有して登録しました。");
    event.target.reset(); pendingFiles = []; drawFiles();
    setTimeout(() => { $("#manual-modal").classList.add("hide"); loadManuals(); }, 450);
  } catch (error) { showStatus($("#manual-status"), error.message, true); }
});

async function loadUsers() {
  const root = $("#user-list");
  try {
    const { users } = await api("/api/users");
    root.replaceChildren();
    users.forEach((user) => root.append(el("div", { class: "source" }, [el("strong", { text: user.displayName }), el("span", { class: "manualmeta", text: ` · ${user.email} · ${user.role} · ${user.active ? "有効" : "停止中"}` })])));
  } catch (error) { root.textContent = error.message; }
}

$("#user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus($("#user-status"), "登録しています…");
  try {
    await api("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: $("#u-name").value, email: $("#u-id").value, role: $("#u-role").value }) });
    showStatus($("#user-status"), "社員を登録しました。本人に会社メールでログインするよう案内してください。");
    event.target.reset(); await loadUsers();
  } catch (error) { showStatus($("#user-status"), error.message, true); }
});

init();
