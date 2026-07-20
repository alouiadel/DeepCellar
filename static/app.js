// --- Auth: load current user, bounce to login if not authenticated ---
fetch("/api/me")
  .then((res) => {
    if (!res.ok) throw new Error("not authenticated");
    return res.json();
  })
  .then((user) => {
    document.getElementById("userInfo").textContent =
      `${user.first_name} ${user.last_name} — @${user.username}`;
    loadModels();
  })
  .catch(() => {
    window.location.href = "/";
  });

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/";
});

// --- Chat state (temporary session: history lives only in this page) ---
const modelSelect = document.getElementById("modelSelect");
const statusArea = document.getElementById("statusArea");
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

const state = {
  models: [], // flat list from /api/ollama/models
  messages: [], // chat memory, resent to Ollama on every turn
  streaming: false,
};

// --- Model picker ---
async function loadModels() {
  setStatus('<p class="loading">Connecting to Ollama…</p>');
  let res;
  try {
    res = await fetch("/api/ollama/models");
  } catch {
    return showError("Could not reach the DeepCellar server.");
  }
  if (res.status === 401) {
    window.location.href = "/";
    return;
  }
  if (res.status === 503) return showOllamaDown();
  if (!res.ok) return showError(`Unexpected server error (${res.status}).`);

  const data = await res.json();
  state.models = [...data.cloud, ...data.local];
  if (!state.models.length)
    return showError("No models installed in Ollama yet.");

  populateSelect(data);
  setStatus("");
  messagesEl.hidden = false;
  chatForm.hidden = false;
  chatInput.focus();
}

function populateSelect(data) {
  const saved = localStorage.getItem("deepcellar_model");
  modelSelect.innerHTML = "";
  for (const [label, models] of [
    ["Cloud", data.cloud],
    ["Local", data.local],
  ]) {
    if (!models.length) continue;
    const group = document.createElement("optgroup");
    group.label = label;
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m.name;
      opt.textContent = m.thinking ? `${m.name} ✦` : m.name;
      group.appendChild(opt);
    }
    modelSelect.appendChild(group);
  }
  if (saved && state.models.some((m) => m.name === saved)) {
    modelSelect.value = saved;
  }
  modelSelect.disabled = false;
}

modelSelect.addEventListener("change", () => {
  localStorage.setItem("deepcellar_model", modelSelect.value);
  // model switch = new conversation
  state.messages = [];
  messagesEl.innerHTML = "";
});

function selectedModel() {
  return state.models.find((m) => m.name === modelSelect.value);
}

// --- Status helpers ---
function setStatus(html) {
  statusArea.innerHTML = html;
  statusArea.hidden = !html;
}

function showOllamaDown() {
  setStatus(`
    <div class="notice error-notice">
      <strong>Ollama isn't running.</strong>
      <p>Start it with <code>ollama serve</code> or open the Ollama app, then retry.</p>
      <button class="btn-secondary" id="retryBtn">Retry</button>
    </div>
  `);
  document.getElementById("retryBtn").addEventListener("click", loadModels);
}

function showError(text) {
  setStatus(`
    <div class="notice error-notice">
      <strong>Something went wrong.</strong>
      <p>${text}</p>
      <button class="btn-secondary" id="retryBtn">Retry</button>
    </div>
  `);
  document.getElementById("retryBtn").addEventListener("click", loadModels);
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
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- Send & stream ---
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// auto-resize textarea
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
});

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
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.name,
        messages: state.messages,
        think: model.thinking,
      }),
    });
    if (res.status === 401) {
      window.location.href = "/";
      return;
    }
    if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

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
    errored = true;
    body.textContent = `⚠ ${err.message || "Connection failed."}`;
    bubble.classList.add("error");
  }

  setStreaming(false);
  if (!errored && content) {
    // keep the reply in memory so the model remembers the conversation
    const msg = { role: "assistant", content };
    if (thinking) msg.thinking = thinking;
    state.messages.push(msg);
    if (thinkingEl)
      thinkingEl.querySelector("summary").textContent = "Thinking";
  } else {
    // failed turn: drop the user message so the history stays consistent
    state.messages.pop();
  }
  chatInput.focus();
}

function setStreaming(on) {
  state.streaming = on;
  sendBtn.disabled = on;
  sendBtn.textContent = on ? "…" : "Send";
  modelSelect.disabled = on;
}
