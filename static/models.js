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

// --- Ollama models ---
const statusArea = document.getElementById("statusArea");
const modelsArea = document.getElementById("modelsArea");

function setStatus(html) {
  statusArea.innerHTML = html;
  statusArea.hidden = !html;
}

function showOllamaDown() {
  modelsArea.hidden = true;
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
  modelsArea.hidden = true;
  setStatus(`
    <div class="notice error-notice">
      <strong>Something went wrong.</strong>
      <p>${text}</p>
      <button class="btn-secondary" id="retryBtn">Retry</button>
    </div>
  `);
  document.getElementById("retryBtn").addEventListener("click", loadModels);
}

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
  renderGroup("cloud", data.cloud);
  renderGroup("local", data.local);
  setStatus("");
  modelsArea.hidden = false;
}

function renderGroup(kind, models) {
  document.getElementById(`${kind}Count`).textContent = `(${models.length})`;
  const container = document.getElementById(`${kind}Models`);
  container.innerHTML = "";
  if (!models.length) {
    container.innerHTML = `<p class="empty">No ${kind} models found.</p>`;
    return;
  }
  models.forEach((m) => container.appendChild(modelCard(m)));
}

function modelCard(m) {
  const card = document.createElement("div");
  card.className =
    "model-card" +
    (m.thinking ? " thinking" : "") +
    (m.chatable ? "" : " nochat");

  const badges = [];
  if (!m.chatable)
    badges.push('<span class="badge badge-nochat">⊘ not chatable</span>');
  if (m.thinking)
    badges.push('<span class="badge badge-thinking">✦ Thinking</span>');
  if (m.cloud) badges.push('<span class="badge badge-cloud">☁ Cloud</span>');
  for (const cap of ["vision", "tools", "embedding"]) {
    if (m.capabilities.includes(cap)) {
      badges.push(`<span class="badge badge-cap">${cap}</span>`);
    }
  }

  const details = [];
  if (m.parameter_size)
    details.push(`<dt>Parameters</dt><dd>${m.parameter_size}</dd>`);
  if (m.quantization)
    details.push(`<dt>Quantization</dt><dd>${m.quantization}</dd>`);
  if (m.family) details.push(`<dt>Family</dt><dd>${m.family}</dd>`);
  if (m.context_length)
    details.push(
      `<dt>Context</dt><dd>${m.context_length.toLocaleString()} tokens</dd>`,
    );
  if (!m.cloud && m.size_bytes)
    details.push(`<dt>Size</dt><dd>${(m.size_bytes / 1e9).toFixed(1)} GB</dd>`);
  if (m.cloud && m.remote_host)
    details.push(`<dt>Host</dt><dd>${new URL(m.remote_host).hostname}</dd>`);

  card.innerHTML = `
    <div class="model-name">${m.name}</div>
    <div class="badges">${badges.join("")}</div>
    <dl class="model-details">${details.join("")}</dl>
  `;
  return card;
}
