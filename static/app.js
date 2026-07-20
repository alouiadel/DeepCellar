// Load current user; bounce back to login if not authenticated
fetch("/api/me")
  .then((res) => {
    if (!res.ok) throw new Error("not authenticated");
    return res.json();
  })
  .then((user) => {
    document.getElementById("welcome").textContent =
      `Welcome, ${user.first_name}!`;
    document.getElementById("userInfo").textContent =
      `${user.first_name} ${user.last_name} — @${user.username}`;
  })
  .catch(() => {
    window.location.href = "/";
  });

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/";
});
