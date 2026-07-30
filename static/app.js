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
  models: [],
  selected: null,
  messages: [],
  chatId: null,
  chats: [],
  streaming: false,
  abortController: null,
};

// --- Utility helpers ---
function _isNearBottom(el, threshold) {
  if (threshold === undefined) threshold = 50;
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

function _showToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.querySelector(".chat-layout").appendChild(toast);
  }
  toast.textContent = msg;
  toast.hidden = false;
  toast.classList.remove("fade-out");
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.add("fade-out");
    toast._timeout = setTimeout(() => {
      toast.hidden = true;
    }, 300);
  }, 2500);
}

function _showConfirmModal(msg, confirmLabel) {
  if (confirmLabel === undefined) confirmLabel = "Delete";
  return new Promise(function (resolve) {
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    var dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    dialog.innerHTML =
      "<p>" +
      msg +
      "</p>" +
      '<div class="modal-actions">' +
      '<button class="btn-secondary modal-cancel">Cancel</button>' +
      '<button class="btn-primary modal-confirm">' +
      confirmLabel +
      "</button>" +
      "</div>";
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function close(val) {
      overlay.remove();
      resolve(val);
    }
    dialog.querySelector(".modal-cancel").onclick = function () {
      return close(false);
    };
    dialog.querySelector(".modal-confirm").onclick = function () {
      return close(true);
    };
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close(false);
    });
    dialog.querySelector(".modal-confirm").focus();
  });
}

function _showEmptyState() {
  messagesEl.innerHTML =
    '<div class="empty-state">Select a chat or start a new one</div>';
  messagesEl.hidden = false;
}

// --- Scroll-to-bottom FAB ---
let _scrollFab = null;

function _createScrollFab() {
  _scrollFab = document.createElement("button");
  _scrollFab.className = "scroll-fab";
  _scrollFab.setAttribute("aria-label", "Scroll to bottom");
  _scrollFab.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
  _scrollFab.addEventListener("click", () => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
    _scrollFab.hidden = true;
  });
  document.querySelector(".chat-layout").appendChild(_scrollFab);
}

function _updateScrollFab() {
  if (!_scrollFab) return;
  if (messagesEl.scrollHeight <= messagesEl.clientHeight + 50) {
    _scrollFab.hidden = true;
    return;
  }
  _scrollFab.hidden = _isNearBottom(messagesEl, 80);
}

messagesEl.addEventListener("scroll", _updateScrollFab);

// --- Model picker (custom dropdown) ---
async function loadModels() {
  const data = await fetchModels({
    statusArea,
    showOllamaDown() {
      setStatus(statusArea, renderOllamaDown());
      bindRetry(loadModels);
    },
    showError(text) {
      setStatus(statusArea, renderError(text));
      bindRetry(loadModels);
    },
  });
  if (!data) return;

  state.models = [...data.cloud, ...data.local].filter(function (m) {
    return m.chatable;
  });
  if (!state.models.length)
    return showError("No chat-capable models found in Ollama.");

  buildPicker(data);
  setStatus(statusArea, "");
  _showEmptyState();
  messagesEl.hidden = false;
  chatForm.hidden = false;
  chatInput.focus();
}

function buildPicker(data) {
  modelPickerPanel.innerHTML = "";
  for (
    var _i = 0,
      _a = [
        ["Cloud", data.cloud],
        ["Local", data.local],
      ];
    _i < _a.length;
    _i++
  ) {
    var _b = _a[_i],
      label = _b[0],
      models = _b[1];
    var chatable = models.filter(function (m) {
      return m.chatable;
    });
    if (!chatable.length) continue;
    var header = document.createElement("div");
    header.className = "model-picker-group";
    header.textContent = label;
    modelPickerPanel.appendChild(header);
    for (var _j = 0; _j < chatable.length; _j++) {
      modelPickerPanel.appendChild(buildOption(chatable[_j]));
    }
  }
  var saved = localStorage.getItem("deepcellar_model");
  var initial = state.models.some(function (m) {
    return m.name === saved;
  })
    ? saved
    : state.models[0].name;
  selectModel(initial, { silent: true });
  modelPickerBtn.disabled = false;
}

function buildOption(m) {
  var opt = document.createElement("button");
  opt.type = "button";
  opt.className = "model-option";
  opt.dataset.model = m.name;
  opt.setAttribute("role", "option");

  var name = document.createElement("span");
  name.className = "opt-name";
  name.textContent = m.name;
  if (m.thinking) {
    var star = document.createElement("span");
    star.className = "opt-star";
    star.textContent = " ✦";
    star.title = "Thinking model";
    name.appendChild(star);
  }
  opt.appendChild(name);

  if (m.parameter_size) {
    var meta = document.createElement("span");
    meta.className = "opt-meta";
    meta.textContent = m.parameter_size;
    opt.appendChild(meta);
  }

  opt.addEventListener("click", function () {
    return selectModel(m.name);
  });
  return opt;
}

function selectModel(name, opts) {
  if (opts === undefined) opts = {};
  var silent = opts.silent === undefined ? false : opts.silent;
  var changed = state.selected !== name;
  state.selected = name;
  var m = selectedModel();
  modelPickerLabel.textContent = m.thinking ? name + " ✦" : name;
  localStorage.setItem("deepcellar_model", name);
  modelPickerPanel.querySelectorAll(".model-option").forEach(function (o) {
    return o.classList.toggle("selected", o.dataset.model === name);
  });
  closePicker();
  if (changed && !silent) {
    resetChat();
    setActiveChat(null);
    renderChatList();
    _showToast("Switched to " + name);
  }
}

function selectedModel() {
  return state.models.find(function (m) {
    return m.name === state.selected;
  });
}

function openPicker() {
  modelPickerPanel.hidden = false;
  modelPicker.classList.add("open");
  modelPickerBtn.setAttribute("aria-expanded", "true");
  var selected = modelPickerPanel.querySelector(".model-option.selected");
  (selected || modelPickerPanel.querySelector(".model-option")).focus();
}

function closePicker() {
  modelPickerPanel.hidden = true;
  modelPicker.classList.remove("open");
  modelPickerBtn.setAttribute("aria-expanded", "false");
}

modelPickerBtn.addEventListener("click", function () {
  modelPickerPanel.hidden ? openPicker() : closePicker();
});

document.addEventListener("click", function (e) {
  if (!modelPicker.contains(e.target)) closePicker();
});

document.addEventListener("keydown", function (e) {
  if (modelPickerPanel.hidden) return;
  if (e.key === "Escape") {
    closePicker();
    modelPickerBtn.focus();
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  var options = Array.prototype.slice.call(
    modelPickerPanel.querySelectorAll(".model-option"),
  );
  var idx = options.indexOf(document.activeElement);
  var next =
    e.key === "ArrowDown"
      ? options[(idx + 1) % options.length]
      : options[(idx - 1 + options.length) % options.length];
  next.focus();
});

// --- Chat sessions (sidebar) ---
var chatListEl = document.getElementById("chatList");
var newChatBtn = document.getElementById("newChatBtn");

newChatBtn.addEventListener("click", newChat);

function setActiveChat(id) {
  state.chatId = id;
  if (id === null) localStorage.removeItem("deepcellar_chat");
  else localStorage.setItem("deepcellar_chat", String(id));
}

async function restoreLastChat() {
  var saved = Number(localStorage.getItem("deepcellar_chat"));
  if (!saved) return;
  if (
    state.chats.some(function (c) {
      return c.id === saved;
    })
  ) {
    await openChat(saved);
  } else {
    localStorage.removeItem("deepcellar_chat");
  }
}

async function loadChats() {
  var res = await fetch("/api/chats");
  if (!res.ok) return;
  state.chats = (await res.json()).chats;
  renderChatList();
}

function relativeTime(iso) {
  var then = new Date(iso.replace(" ", "T") + "Z");
  var secs = Math.max(0, (Date.now() - then.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return Math.floor(secs / 60) + "m ago";
  if (secs < 86400) return Math.floor(secs / 3600) + "h ago";
  if (secs < 30 * 86400) return Math.floor(secs / 86400) + "d ago";
  return then.toLocaleDateString();
}

function _startRename(chat, titleEl) {
  var original = chat.title || "";
  var input = document.createElement("input");
  input.type = "text";
  input.className = "chat-item-title-edit";
  input.value = original;

  var done = false;

  function finish(save) {
    if (done) return;
    done = true;
    var val = input.value.trim();
    if (save && val && val !== chat.title) {
      fetch("/api/chats/" + chat.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: val }),
      }).then(function () {
        return loadChats();
      });
    } else {
      titleEl.textContent = original || chat.model || "New chat";
      titleEl.hidden = false;
      input.remove();
    }
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    }
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", function () {
    return finish(false);
  });

  titleEl.hidden = true;
  titleEl.parentNode.insertBefore(input, titleEl.nextSibling);
  input.focus();
  input.select();
}

function renderChatList() {
  chatListEl.innerHTML = "";
  for (var _k = 0, _c = state.chats; _k < _c.length; _k++) {
    var chat = _c[_k];
    var item = document.createElement("div");
    item.className = "chat-item" + (chat.id === state.chatId ? " active" : "");

    var text = document.createElement("div");
    text.className = "chat-item-text";
    var title = document.createElement("div");
    title.className = "chat-item-title";
    title.textContent = chat.title || chat.model || "New chat";
    title.addEventListener(
      "dblclick",
      (function (chat, title) {
        return function () {
          return _startRename(chat, title);
        };
      })(chat, title),
    );
    var time = document.createElement("div");
    time.className = "chat-item-time";
    time.textContent = relativeTime(chat.updated_at);
    text.append(title, time);

    var del = document.createElement("button");
    del.className = "chat-delete reveal-on-hover";
    del.textContent = "\u00d7";
    del.title = "Delete chat";
    del.setAttribute("aria-label", "Delete chat");
    del.addEventListener(
      "click",
      (function (id) {
        return function (e) {
          e.stopPropagation();
          deleteChat(id);
        };
      })(chat.id),
    );

    item.append(text, del);
    item.addEventListener(
      "click",
      (function (id) {
        return function () {
          return openChat(id);
        };
      })(chat.id),
    );
    chatListEl.appendChild(item);
  }
}

async function newChat() {
  if (state.streaming || !state.selected) return;
  var res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: state.selected }),
  });
  if (!res.ok) return;
  var chat = await res.json();
  setActiveChat(chat.id);
  resetChat();
  await loadChats();
  chatInput.focus();
}

async function openChat(id) {
  if (state.streaming || id === state.chatId) return;
  var res = await fetch("/api/chats/" + id);
  if (!res.ok) return;
  var chat = await res.json();
  setActiveChat(chat.id);
  state.messages = chat.messages.map(function (m) {
    var msg = { role: m.role, content: m.content };
    if (m.thinking) msg.thinking = m.thinking;
    return msg;
  });
  if (
    state.models.some(function (m) {
      return m.name === chat.model;
    })
  ) {
    selectModel(chat.model, { silent: true });
  }
  renderHistory();
  renderChatList();
  if (_scrollFab) _scrollFab.hidden = true;
  chatInput.focus();
}

async function deleteChat(id) {
  var ok = await _showConfirmModal("Delete this chat?");
  if (!ok) return;
  var res = await fetch("/api/chats/" + id, { method: "DELETE" });
  if (!res.ok) return;
  if (state.chatId === id) {
    setActiveChat(null);
    resetChat();
  }
  await loadChats();
}

function renderHistory() {
  messagesEl.innerHTML = "";
  if (!state.messages.length) {
    _showEmptyState();
    return;
  }
  for (var _l = 0, _d = state.messages; _l < _d.length; _l++) {
    var m = _d[_l];
    if (m.role === "user") {
      addBubble("user", m.content, m.created_at);
      continue;
    }
    var bubble = addBubble("assistant", "", m.created_at);
    var body = bubble.querySelector(".bubble-text");
    if (m.thinking) {
      var thinkingEl = document.createElement("details");
      thinkingEl.className = "thinking-block";
      thinkingEl.innerHTML =
        "<summary>Thinking</summary><div class='thinking-text'></div>";
      thinkingEl.querySelector(".thinking-text").textContent = m.thinking;
      bubble.insertBefore(thinkingEl, body);
    }
    renderMarkdown(body, m.content);
    addCodeCopyButtons(body);
  }
  _appendLastRegenerateBtn();
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- State helpers ---
function resetChat() {
  state.messages = [];
  _showEmptyState();
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

function renderMarkdown(el, text) {
  if (window.marked && window.DOMPurify) {
    el.innerHTML = DOMPurify.sanitize(marked.parse(text));
  } else {
    el.textContent = text;
  }
}

function _formatTime(iso) {
  if (!iso) return "";
  var d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addBubble(role, text, createdAt) {
  var bubble = document.createElement("div");
  bubble.className = "bubble " + role;
  var body = document.createElement("div");
  body.className = "bubble-text";
  body.textContent = text;
  bubble.appendChild(body);

  if (role === "assistant") {
    var copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn reveal-on-hover";
    copyBtn.setAttribute("aria-label", "Copy message");
    copyBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyBtn.addEventListener("click", function () {
      copyToClipboard(body.textContent).then(function () {
        return flashCopied(copyBtn);
      });
    });
    bubble.appendChild(copyBtn);
  }

  if (createdAt) {
    var timeEl = document.createElement("time");
    timeEl.className = "bubble-time";
    timeEl.textContent = _formatTime(createdAt);
    bubble.appendChild(timeEl);
  }

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function addCodeCopyButtons(container) {
  for (
    var _m = 0, _e = container.querySelectorAll("pre");
    _m < _e.length;
    _m++
  ) {
    var pre = _e[_m];
    if (pre.parentElement.classList.contains("code-block")) continue;
    var wrap = document.createElement("div");
    wrap.className = "code-block";
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    var btn = document.createElement("button");
    btn.className = "code-copy-btn reveal-on-hover";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code");
    btn.addEventListener("click", function () {
      var code = pre.querySelector("code");
      copyToClipboard(code ? code.textContent : pre.textContent).then(
        function () {
          btn.textContent = "Copied";
          flashCopied(btn, function () {
            btn.textContent = "Copy";
          });
        },
      );
    });
    wrap.appendChild(btn);
  }
}

// --- Regenerate ---
function _appendLastRegenerateBtn() {
  var bubbles = messagesEl.querySelectorAll(".bubble.assistant");
  var last = bubbles[bubbles.length - 1];
  if (!last) return;
  if (last.querySelector(".regenerate-btn")) return;
  if (state.streaming) return;
  var btn = document.createElement("button");
  btn.className = "regenerate-btn";
  btn.textContent = "Regenerate";
  btn.title = "Regenerate response";
  btn.addEventListener("click", regenerate);
  last.appendChild(btn);
}

function _removeLastRegenerateBtn() {
  var btn = document.querySelector(".bubble.assistant .regenerate-btn");
  if (btn) btn.remove();
}

async function regenerate() {
  if (state.streaming) return;
  var last = state.messages[state.messages.length - 1];
  if (!last || last.role !== "assistant") return;
  if (!state.chatId) return;

  state.messages.pop();
  var bubbles = messagesEl.querySelectorAll(".bubble.assistant");
  var lastBubble = bubbles[bubbles.length - 1];
  if (lastBubble) lastBubble.remove();

  _removeLastRegenerateBtn();
  await _doStream({ regenerate: true });
}

// --- Send & stream ---
chatForm.addEventListener("submit", function (e) {
  e.preventDefault();
  sendMessage();
});

sendBtn.addEventListener("click", function (e) {
  if (state.streaming) {
    e.preventDefault();
    state.abortController && state.abortController.abort();
  }
});

chatInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

chatInput.addEventListener("input", function () {
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
  var text = chatInput.value.trim();
  var model = selectedModel();
  if (!text || !model || state.streaming) return;

  state.messages.push({ role: "user", content: text });
  addBubble("user", text, new Date().toISOString());
  _removeLastRegenerateBtn();
  chatInput.value = "";
  chatInput.style.height = "auto";
  await _doStream({});
}

async function _doStream(opts) {
  if (opts === undefined) opts = {};
  var regenerateFlag = opts.regenerate === undefined ? false : opts.regenerate;
  setStreaming(true);

  var model = selectedModel();
  var bubble = addBubble("assistant", ".", new Date().toISOString());
  bubble.classList.add("typing");
  var body = bubble.querySelector(".bubble-text");
  var thinkingEl = null;
  var content = "";
  var thinking = "";
  var errored = false;
  var firstChunk = true;

  try {
    var controller = new AbortController();
    state.abortController = controller;
    var res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.name,
        messages: state.messages,
        think: model.thinking,
        chat_id: state.chatId,
        regenerate: regenerateFlag,
      }),
      signal: controller.signal,
    });
    if (redirectIfUnauthorized(res.status)) return;
    if (!res.ok || !res.body) throw new Error("Server error " + res.status);

    var createdChatId = res.headers.get("X-Chat-Id");
    if (createdChatId && !state.chatId) {
      setActiveChat(Number(createdChatId));
      loadChats();
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";

    for (;;) {
      var _a = await reader.read(),
        done = _a.done,
        value = _a.value;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      var lines = buffer.split("\n");
      buffer = lines.pop();

      for (var _i = 0, _b = lines; _i < _b.length; _i++) {
        var line = _b[_i];
        if (!line.trim()) continue;
        var chunk = JSON.parse(line);
        if (chunk.error) {
          errored = true;
          body.textContent = "\u26a0 " + chunk.error;
          bubble.classList.add("error");
          continue;
        }
        if (chunk.message && chunk.message.thinking) {
          thinking += chunk.message.thinking;
          if (!thinkingEl) {
            thinkingEl = document.createElement("details");
            thinkingEl.className = "thinking-block";
            thinkingEl.innerHTML =
              "<summary>Thinking\u2026</summary><div class='thinking-text'></div>";
            bubble.insertBefore(thinkingEl, body);
          }
          thinkingEl.querySelector(".thinking-text").textContent = thinking;
        }
        if (chunk.message && chunk.message.content) {
          if (firstChunk) {
            body.textContent = "";
            bubble.classList.remove("typing");
            firstChunk = false;
          }
          content += chunk.message.content;
          renderMarkdown(body, content);
        }
        if (_isNearBottom(messagesEl)) {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        if (_scrollFab) _updateScrollFab();
      }
    }
    // final render to catch any remaining content
    if (content && firstChunk) {
      body.textContent = "";
      bubble.classList.remove("typing");
    }
    if (content) {
      renderMarkdown(body, content);
      addCodeCopyButtons(body);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (err) {
    if (err.name === "AbortError") {
      if (thinkingEl)
        thinkingEl.querySelector("summary").textContent = "Thinking";
      if (content) {
        bubble.classList.add("aborted");
        renderMarkdown(body, content);
      }
    } else {
      errored = true;
      body.textContent = "\u26a0 " + (err.message || "Connection failed.");
      bubble.classList.add("error");
    }
  } finally {
    state.abortController = null;
  }

  bubble.classList.remove("typing");
  setStreaming(false);
  if (!errored && content) {
    var msg = { role: "assistant", content: content };
    if (thinking) msg.thinking = thinking;
    state.messages.push(msg);
    if (thinkingEl)
      thinkingEl.querySelector("summary").textContent = "Thinking";
    if (state.chatId) loadChats();
    _appendLastRegenerateBtn();
  } else {
    state.messages.pop();
  }
  chatInput.focus();
  if (_scrollFab) _updateScrollFab();
}

function setStreaming(on) {
  state.streaming = on;
  sendBtn.classList.toggle("busy", on);
  sendBtn.setAttribute("aria-label", on ? "Stop generation" : "Send message");
  var svg = sendBtn.querySelector("svg");
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

// --- Init scroll FAB ---
_createScrollFab();
