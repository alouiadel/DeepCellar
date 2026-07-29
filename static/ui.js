function setStatus(area, html) {
  area.innerHTML = html;
  area.hidden = !html;
}

function renderOllamaDown() {
  return `
    <div class="notice error-notice">
      <strong>Ollama isn't running.</strong>
      <p>Start it with <code>ollama serve</code> or open the Ollama app, then retry.</p>
      <button class="btn-secondary" id="retryBtn">Retry</button>
    </div>
  `;
}

function renderError(text) {
  return `
    <div class="notice error-notice">
      <strong>Something went wrong.</strong>
      <p>${text}</p>
      <button class="btn-secondary" id="retryBtn">Retry</button>
    </div>
  `;
}

function bindRetry(fn) {
  const btn = document.getElementById("retryBtn");
  if (btn) btn.addEventListener("click", fn);
}

function redirectIfUnauthorized(status) {
  if (status === 401) {
    window.location.href = "/";
    return true;
  }
  return false;
}

function copyToClipboard(text) {
  return navigator.clipboard.writeText(text);
}

function flashCopied(el, restoreFn) {
  el.classList.add("copied");
  setTimeout(() => {
    el.classList.remove("copied");
    if (restoreFn) restoreFn();
  }, 1500);
}

async function fetchModels({ statusArea, showOllamaDown, showError }) {
  setStatus(statusArea, '<p class="loading">Connecting to Ollama…</p>');
  let res;
  try {
    res = await fetch("/api/ollama/models");
  } catch {
    showError("Could not reach the DeepCellar server.");
    return null;
  }
  if (res.status === 401) {
    window.location.href = "/";
    return null;
  }
  if (res.status === 503) { showOllamaDown(); return null; }
  if (!res.ok) { showError(`Unexpected server error (${res.status}).`); return null; }
  return await res.json();
}
