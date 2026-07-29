initAuth(async () => {
  await loadModels();
  await loadChats();
  restoreLastChat();
});
bindLogout();

// --- Chat state ---
const statusArea = document.getElementById("statusArea");
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const modelPicker = document.getElementById("modelPicker");
const modelPickerBtn = document.getElementById("modelPickerBtn");
const modelPickerLabel = document.getElementById("modelPickerLabel");
const modelPickerPanel = document.getElementById("modelPickerPanel");

const state = {
  models: [], // flat list from /api/ollama/models
  selected: null, // selected model name
  messages: [], // chat memory, resent to Ollama on every turn
  chatId: null, // active chat; null until the first message auto-creates one
  chats: [], // sidebar list from /api/chats
  streaming: false,
  abortController: null,
};

// --- Model picker (custom dropdown) ---
async function loadModels() {
  const data = await fetchModels({
    statusArea,
    showOllamaDown() { setStatus(statusArea, renderOllamaDown()); bindRetry(loadModels); },
    showError(text) { setStatus(statusArea, renderError(text)); bindRetry(loadModels); },
  });
  if (!data) return;

  state.models = [...data.cloud, ...data.local].filter((m) => m.chatable);
  if (!state.models.length)
    return showError("No chat-capable models found in Ollama.");

  buildPicker(data);
  setStatus(statusArea, "");
  messagesEl.hidden = false;
  chatForm.hidden = false;
  chatInput.focus();
}

function buildPicker(data) {
  modelPickerPanel.innerHTML = "";
  for (const [label, models] of [
    ["Cloud", data.cloud],
    ["Local", data.local],
  ]) {
    const chatable = models.filter((m) => m.chatable);
    if (!chatable.length) continue;
    const header = document.createElement("div");
    header.className = "model-picker-group";
    header.textContent = label;
    modelPickerPanel.appendChild(header);
    for (const m of chatable) {
      modelPickerPanel.appendChild(buildOption(m));
    }
  }
  const saved = localStorage.getItem("deepcellar_model");
  const initial = state.models.some((m) => m.name === saved)
    ? saved
    : state.models[0].name;
  selectModel(initial, { silent: true });
  modelPickerBtn.disabled = false;
}

function buildOption(m) {
  const opt = document.createElement("button");
  opt.type = "button";
  opt.className = "model-option";
  opt.dataset.model = m.name;
  opt.setAttribute("role", "option");

  const name = document.createElement("span");
  name.className = "opt-name";
  name.textContent = m.name;
  if (m.thinking) {
    const star = document.createElement("span");
    star.className = "opt-star";
    star.textContent = " ✦";
    star.title = "Thinking model";
    name.appendChild(star);
  }
  opt.appendChild(name);

  if (m.parameter_size) {
    const meta = document.createElement("span");
    meta.className = "opt-meta";
    meta.textContent = m.parameter_size;
    opt.appendChild(meta);
  }

  opt.addEventListener("click", () => selectModel(m.name));
  return opt;
}

function selectModel(name, { silent = false } = {}) {
  const changed = state.selected !== name;
  state.selected = name;
  const m = selectedModel();
  modelPickerLabel.textContent = m.thinking ? `${name} ✦` : name;
  localStorage.setItem("deepcellar_model", name);
  modelPickerPanel
    .querySelectorAll(".model-option")
    .forEach((o) => o.classList.toggle("selected", o.dataset.model === name));
  closePicker();
  if (changed && !silent) {
    resetChat();
    setActiveChat(null);
    renderChatList();
  }
}

function selectedModel() {
  return state.models.find((m) => m.name === state.selected);
}

function openPicker() {
  modelPickerPanel.hidden = false;
  modelPicker.classList.add("open");
  modelPickerBtn.setAttribute("aria-expanded", "true");
  const selected = modelPickerPanel.querySelector(".model-option.selected");
  (selected || modelPickerPanel.querySelector(".model-option"))?.focus();
}

function closePicker() {
  modelPickerPanel.hidden = true;
  modelPicker.classList.remove("open");
  modelPickerBtn.setAttribute("aria-expanded", "false");
}

modelPickerBtn.addEventListener("click", () => {
  modelPickerPanel.hidden ? openPicker() : closePicker();
});

document.addEventListener("click", (e) => {
  if (!modelPicker.contains(e.target)) closePicker();
});

document.addEventListener("keydown", (e) => {
  if (modelPickerPanel.hidden) return;
  if (e.key === "Escape") {
    closePicker();
    modelPickerBtn.focus();
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  const options = [...modelPickerPanel.querySelectorAll(".model-option")];
  const idx = options.indexOf(document.activeElement);
  const next =
    e.key === "ArrowDown"
      ? options[(idx + 1) % options.length]
      : options[(idx - 1 + options.length) % options.length];
  next.focus();
});

// --- Chat sessions (sidebar) ---
const chatListEl = document.getElementById("chatList");
const newChatBtn = document.getElementById("newChatBtn");

newChatBtn.addEventListener("click", newChat);

// the active chat survives a reload via localStorage
function setActiveChat(id) {
  state.chatId = id;
  if (id === null) localStorage.removeItem("deepcellar_chat");
  else localStorage.setItem("deepcellar_chat", String(id));
}

async function restoreLastChat() {
  const saved = Number(localStorage.getItem("deepcellar_chat"));
  if (!saved) return;
  if (state.chats.some((c) => c.id === saved)) {
    await openChat(saved);
  } else {
    localStorage.removeItem("deepcellar_chat");
  }
}

async function loadChats() {
  const res = await fetch("/api/chats");
  if (!res.ok) return;
  state.chats = (await res.json()).chats;
  renderChatList();
}

// server timestamps are UTC ("YYYY-MM-DD HH:MM:SS") without a timezone marker
function relativeTime(iso) {
  const then = new Date(iso.replace(" ", "T") + "Z");
  const secs = Math.max(0, (Date.now() - then.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 30 * 86400) return `${Math.floor(secs / 86400)}d ago`;
  return then.toLocaleDateString();
}

function renderChatList() {
  chatListEl.innerHTML = "";
  for (const chat of state.chats) {
    const item = document.createElement("div");
    item.className = "chat-item" + (chat.id === state.chatId ? " active" : "");

    const text = document.createElement("div");
    text.className = "chat-item-text";
    const title = document.createElement("div");
    title.className = "chat-item-title";
    title.textContent = chat.title || "New chat";
    const time = document.createElement("div");
    time.className = "chat-item-time";
    time.textContent = relativeTime(chat.updated_at);
    text.append(title, time);

    const del = document.createElement("button");
    del.className = "chat-delete reveal-on-hover";
    del.textContent = "×";
    del.title = "Delete chat";
    del.setAttribute("aria-label", "Delete chat");
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    });

    item.append(text, del);
    item.addEventListener("click", () => openChat(chat.id));
    chatListEl.appendChild(item);
  }
}

async function newChat() {
  if (state.streaming || !state.selected) return;
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: state.selected }),
  });
  if (!res.ok) return;
  const chat = await res.json();
  setActiveChat(chat.id);
  resetChat();
  await loadChats();
  chatInput.focus();
}

async function openChat(id) {
  if (state.streaming || id === state.chatId) return;
  const res = await fetch(`/api/chats/${id}`);
  if (!res.ok) return;
  const chat = await res.json();
  setActiveChat(chat.id);
  state.messages = chat.messages.map((m) => {
    const msg = { role: m.role, content: m.content };
    if (m.thinking) msg.thinking = m.thinking;
    return msg;
  });
  if (state.models.some((m) => m.name === chat.model)) {
    selectModel(chat.model, { silent: true });
  }
  renderHistory();
  renderChatList();
  chatInput.focus();
}

async function deleteChat(id) {
  const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
  if (!res.ok) return;
  if (state.chatId === id) {
    setActiveChat(null);
    resetChat();
  }
  await loadChats();
}

function renderHistory() {
  messagesEl.innerHTML = "";
  for (const m of state.messages) {
    if (m.role === "user") {
      addBubble("user", m.content);
      continue;
    }
    const bubble = addBubble("assistant", "");
    const body = bubble.querySelector(".bubble-text");
    if (m.thinking) {
      const thinkingEl = document.createElement("details");
      thinkingEl.className = "thinking-block";
      thinkingEl.innerHTML =
        "<summary>Thinking</summary><div class='thinking-text'></div>";
      thinkingEl.querySelector(".thinking-text").textContent = m.thinking;
      bubble.insertBefore(thinkingEl, body);
    }
    renderMarkdown(body, m.content);
    addCodeCopyButtons(body);
  }
  scrollToBottom();
}

// --- State helpers ---
function resetChat() {
  state.messages = [];
  messagesEl.innerHTML = "";
}

function showOllamaDown() {
  setStatus(statusArea, renderOllamaDown());
  bindRetry(loadModels);
}

function showError(text) {
  setStatus(statusArea, renderError(text));
  bindRetry(loadModels);
}

// --- Rendering ---
if (window.marked) {
  marked.setOptions({ breaks: true, gfm: true });
}

// Render LLM markdown safely (model output is untrusted -> sanitize).
function renderMarkdown(el, text) {
  if (window.marked && window.DOMPurify) {
    el.innerHTML = DOMPurify.sanitize(marked.parse(text));
  } else {
    el.textContent = text;
  }
}

function addBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  const body = document.createElement("div");
  body.className = "bubble-text";
  body.textContent = text;
  bubble.appendChild(body);

  if (role === "assistant") {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn reveal-on-hover";
    copyBtn.setAttribute("aria-label", "Copy message");
    copyBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyBtn.addEventListener("click", () => {
      copyToClipboard(body.textContent).then(() => flashCopied(copyBtn));
    });
    bubble.appendChild(copyBtn);
  }

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

// Wrap each code block with a hover copy button (called once rendering is final)
function addCodeCopyButtons(container) {
  for (const pre of container.querySelectorAll("pre")) {
    if (pre.parentElement.classList.contains("code-block")) continue;
    const wrap = document.createElement("div");
    wrap.className = "code-block";
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const btn = document.createElement("button");
    btn.className = "code-copy-btn reveal-on-hover";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code");
    btn.addEventListener("click", () => {
      const code = pre.querySelector("code");
      copyToClipboard(code ? code.textContent : pre.textContent).then(() => {
        btn.textContent = "Copied";
        flashCopied(btn, () => { btn.textContent = "Copy"; });
      });
    });
    wrap.appendChild(btn);
  }
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- Send & stream ---
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
});

sendBtn.addEventListener("click", (e) => {
  if (state.streaming) {
    e.preventDefault();
    state.abortController?.abort();
  }
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// auto-resize textarea + enable send only when there's text
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
  updateSendBtn();
});

function updateSendBtn() {
  if (state.streaming) {
    sendBtn.disabled = false;
  } else {
    sendBtn.disabled = !chatInput.value.trim();
  }
}

async function sendMessage() {
  const text = chatInput.value.trim();
  const model = selectedModel();
  if (!text || !model || state.streaming) return;

  state.messages.push({ role: "user", content: text });
  addBubble("user", text);
  chatInput.value = "";
  chatInput.style.height = "auto";
  setStreaming(true);

  const bubble = addBubble("assistant", "");
  const body = bubble.querySelector(".bubble-text");
  let thinkingEl = null;
  let content = "";
  let thinking = "";
  let errored = false;

  try {
    const controller = new AbortController();
    state.abortController = controller;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.name,
        messages: state.messages,
        think: model.thinking,
        chat_id: state.chatId,
      }),
      signal: controller.signal,
    });
    if (redirectIfUnauthorized(res.status)) return;
    if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

    // first message without a picked chat: the server auto-created one
    const createdChatId = res.headers.get("X-Chat-Id");
    if (createdChatId && !state.chatId) {
      setActiveChat(Number(createdChatId));
      loadChats();
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // last chunk may be incomplete

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line);
        if (chunk.error) {
          errored = true;
          body.textContent = `⚠ ${chunk.error}`;
          bubble.classList.add("error");
          continue;
        }
        if (chunk.message?.thinking) {
          thinking += chunk.message.thinking;
          if (!thinkingEl) {
            thinkingEl = document.createElement("details");
            thinkingEl.className = "thinking-block";
            thinkingEl.innerHTML =
              "<summary>Thinking…</summary><div class='thinking-text'></div>";
            bubble.insertBefore(thinkingEl, body);
          }
          thinkingEl.querySelector(".thinking-text").textContent = thinking;
        }
        if (chunk.message?.content) {
          content += chunk.message.content;
          renderMarkdown(body, content);
        }
        scrollToBottom();
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      // user clicked stop — keep partial content
      if (thinkingEl)
        thinkingEl.querySelector("summary").textContent = "Thinking";
    } else {
      errored = true;
      body.textContent = `⚠ ${err.message || "Connection failed."}`;
      bubble.classList.add("error");
    }
  } finally {
    state.abortController = null;
  }

  setStreaming(false);
  if (!errored && content) {
    // keep the reply in memory so the model remembers the conversation
    const msg = { role: "assistant", content };
    if (thinking) msg.thinking = thinking;
    state.messages.push(msg);
    if (thinkingEl)
      thinkingEl.querySelector("summary").textContent = "Thinking";
    // server persisted the turn — refresh sidebar (auto-title, ordering)
    if (state.chatId) loadChats();
    addCodeCopyButtons(body);
  } else {
    // failed turn: drop the user message so the history stays consistent
    state.messages.pop();
  }
  chatInput.focus();
}

function setStreaming(on) {
  state.streaming = on;
  sendBtn.classList.toggle("busy", on);
  sendBtn.setAttribute("aria-label", on ? "Stop generation" : "Send message");
  const svg = sendBtn.querySelector("svg");
  if (on) {
    svg.innerHTML =
      '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>';
  } else {
    svg.innerHTML =
      '<path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  updateSendBtn();
  modelPickerBtn.disabled = on;
  if (on) closePicker();
}
