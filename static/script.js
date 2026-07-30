// --- View toggle (login <-> signup) ---
const loginView = document.getElementById("loginView");
const signupView = document.getElementById("signupView");

document.getElementById("showSignup").addEventListener("click", (e) => {
  e.preventDefault();
  loginView.hidden = true;
  signupView.hidden = false;
  document.getElementById("firstName").focus();
});

document.getElementById("showLogin").addEventListener("click", (e) => {
  e.preventDefault();
  signupView.hidden = true;
  loginView.hidden = false;
  document.getElementById("loginUsername").focus();
});

// --- Show / hide password buttons ---
document.querySelectorAll(".toggle-password").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "Hide" : "Show";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
});

// --- Helpers ---
function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `message ${type}`;
}

function apiError(data, fallback) {
  // FastAPI returns detail as a string (our errors) or a list (validation)
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail.length) {
    return data.detail[0].msg || fallback;
  }
  return fallback;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const USERNAME_RE = /^[A-Za-z0-9_-]{3,30}$/;

// --- Login ---
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    showMessage(loginMessage, "Please fill in all fields.", "error");
    return;
  }

  const btn = loginForm.querySelector(".btn-primary");
  btn.disabled = true;
  btn.textContent = "Signing in...";
  showMessage(loginMessage, "", "success");
  const { ok, data } = await apiPost("/api/login", { username, password });

  if (ok) {
    window.location.href = "/app.html";
  } else {
    btn.disabled = false;
    btn.textContent = "Sign in";
    showMessage(loginMessage, apiError(data, "Login failed."), "error");
  }
});

// --- Signup ---
const signupForm = document.getElementById("signupForm");
const signupMessage = document.getElementById("signupMessage");

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const first_name = document.getElementById("firstName").value.trim();
  const last_name = document.getElementById("lastName").value.trim();
  const username = document.getElementById("signupUsername").value.trim();
  const password = document.getElementById("signupPassword").value;

  if (!first_name || !last_name || !username || !password) {
    showMessage(signupMessage, "Please fill in all fields.", "error");
    return;
  }
  if (!USERNAME_RE.test(username)) {
    showMessage(
      signupMessage,
      "Username must be 3-30 characters: letters, digits, _ or -",
      "error",
    );
    return;
  }
  if (password.length < 8) {
    showMessage(
      signupMessage,
      "Password must be at least 8 characters.",
      "error",
    );
    return;
  }

  const btn = signupForm.querySelector(".btn-primary");
  btn.disabled = true;
  btn.textContent = "Creating account...";
  showMessage(signupMessage, "", "success");
  const { ok, data } = await apiPost("/api/signup", {
    username,
    first_name,
    last_name,
    password,
  });

  if (!ok) {
    btn.disabled = false;
    btn.textContent = "Create account";
    showMessage(signupMessage, apiError(data, "Signup failed."), "error");
    return;
  }

  const login = await apiPost("/api/login", { username, password });
  if (login.ok) {
    window.location.href = "/app.html";
  } else {
    btn.disabled = false;
    btn.textContent = "Create account";
    showMessage(signupMessage, "Account created! Please sign in.", "success");
    document.getElementById("showLogin").click();
  }
});

// --- Already logged in? Go straight to the app ---
fetch("/api/me").then((res) => {
  if (res.ok) window.location.href = "/app.html";
});
