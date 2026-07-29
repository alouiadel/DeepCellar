function initAuth(onUser) {
  fetch("/api/me")
    .then((res) => {
      if (!res.ok) throw new Error("not authenticated");
      return res.json();
    })
    .then((user) => {
      const avatar = document.createElement("img");
      avatar.className = "user-avatar";
      avatar.src = "/api/avatar/me";
      avatar.alt = "";
      avatar.width = 32;
      avatar.height = 32;
      const info = document.getElementById("userInfo");
      info.parentNode.insertBefore(avatar, info);
      info.textContent = `${user.first_name} ${user.last_name} — @${user.username}`;
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
