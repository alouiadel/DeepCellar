export async function apiJson(url, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    ...rest,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data, res };
}
