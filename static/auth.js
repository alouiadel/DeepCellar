function initAuth(onUser) {
  fetch("/api/me")
    .then((res) => {
      if (!res.ok) throw new Error("not authenticated");
      return res.json();
    })
    .then((user) => {
      document.getElementById("userInfo").textContent =
        `${user.first_name} ${user.last_name} — @${user.username}`;
      const avatar = document.getElementById("userAvatar");
      if (avatar) avatar.src = "/api/avatar/me";
      onUser(user);
    })
    .catch(() => {
      window.location.href = "/";
    });
}

function bindLogout() {
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  });
}
