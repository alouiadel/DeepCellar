initAuth(loadModels);
bindLogout();

// --- Ollama models ---
const statusArea = document.getElementById("statusArea");
const modelsArea = document.getElementById("modelsArea");

// --- Search/filter ---
let _allModels = { cloud: [], local: [] };
let _searchInput = null;

function _createSearchInput() {
  _searchInput = document.createElement("input");
  _searchInput.type = "text";
  _searchInput.className = "model-search";
  _searchInput.placeholder = "Filter models...";
  _searchInput.autocomplete = "off";
  _searchInput.addEventListener("input", _applyFilter);
  const content = document.querySelector(".content");
  content.insertBefore(_searchInput, document.getElementById("modelsArea"));
}

function _applyFilter() {
  const q = _searchInput.value.toLowerCase().trim();
  if (!q) {
    renderGroup("cloud", _allModels.cloud);
    renderGroup("local", _allModels.local);
    return;
  }
  renderGroup(
    "cloud",
    _allModels.cloud.filter(function (m) {
      return m.name.toLowerCase().includes(q);
    }),
  );
  renderGroup(
    "local",
    _allModels.local.filter(function (m) {
      return m.name.toLowerCase().includes(q);
    }),
  );
}

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

  _allModels = data;
  if (!_searchInput) _createSearchInput();
  _applyFilter();
  setStatus(statusArea, "");
  modelsArea.hidden = false;
}

function renderGroup(kind, models) {
  document.getElementById(kind + "Count").textContent =
    "(" + models.length + ")";
  const container = document.getElementById(kind + "Models");
  container.innerHTML = "";
  if (!models.length) {
    container.innerHTML = '<p class="empty">No ' + kind + " models found.</p>";
    return;
  }
  models.forEach(function (m) {
    return container.appendChild(modelCard(m));
  });
}

function modelCard(m) {
  const card = document.createElement("div");
  card.className =
    "model-card" +
    (m.thinking ? " thinking" : "") +
    (m.chatable ? "" : " nochat");

  const badges = [];
  if (!m.chatable)
    badges.push('<span class="badge badge-nochat">\u2298 not chatable</span>');
  if (m.thinking)
    badges.push('<span class="badge badge-thinking">\u2726 Thinking</span>');
  if (m.cloud)
    badges.push('<span class="badge badge-cloud">\u2601 Cloud</span>');
  for (
    var _i = 0, _a = ["vision", "tools", "embedding"];
    _i < _a.length;
    _i++
  ) {
    var cap = _a[_i];
    if (m.capabilities.indexOf(cap) !== -1) {
      badges.push('<span class="badge badge-cap">' + cap + "</span>");
    }
  }

  const details = [];
  if (m.parameter_size)
    details.push("<dt>Parameters</dt><dd>" + m.parameter_size + "</dd>");
  if (m.quantization)
    details.push("<dt>Quantization</dt><dd>" + m.quantization + "</dd>");
  if (m.family) details.push("<dt>Family</dt><dd>" + m.family + "</dd>");
  if (m.context_length)
    details.push(
      "<dt>Context</dt><dd>" +
        m.context_length.toLocaleString() +
        " tokens</dd>",
    );
  if (!m.cloud && m.size_bytes)
    details.push(
      "<dt>Size</dt><dd>" + (m.size_bytes / 1e9).toFixed(1) + " GB</dd>",
    );
  if (m.cloud && m.remote_host)
    details.push(
      "<dt>Host</dt><dd>" + new URL(m.remote_host).hostname + "</dd>",
    );

  card.innerHTML =
    '<div class="model-name-wrapper"><div class="model-name">' +
    m.name +
    "</div></div>" +
    '<div class="badges">' +
    badges.join("") +
    "</div>" +
    '<dl class="model-details">' +
    details.join("") +
    "</dl>";

  const wrapper = card.querySelector(".model-name-wrapper");
  const copyBtn = document.createElement("button");
  copyBtn.className = "model-copy-btn";
  copyBtn.textContent = "Copy";
  copyBtn.title = "Copy model name";
  copyBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    copyToClipboard(m.name).then(function () {
      return flashCopied(copyBtn, function () {
        copyBtn.textContent = "Copy";
      });
    });
  });
  wrapper.appendChild(copyBtn);

  return card;
}

_createSearchInput();
