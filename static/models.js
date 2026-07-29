initAuth(loadModels);
bindLogout();

// --- Ollama models ---
const statusArea = document.getElementById("statusArea");
const modelsArea = document.getElementById("modelsArea");

function showOllamaDown() {
  modelsArea.hidden = true;
  setStatus(statusArea, renderOllamaDown());
  bindRetry(loadModels);
}

function showError(text) {
  modelsArea.hidden = true;
  setStatus(statusArea, renderError(text));
  bindRetry(loadModels);
}

async function loadModels() {
  const data = await fetchModels({
    statusArea,
    showOllamaDown,
    showError,
  });
  if (!data) return;

  renderGroup("cloud", data.cloud);
  renderGroup("local", data.local);
  setStatus(statusArea, "");
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
