const BASE = import.meta.env.VITE_API_URL;

let token = localStorage.getItem("token");

export function setToken(t) {
  token = t;
  localStorage.setItem("token", t);
}

export function clearToken() {
  token = null;
  localStorage.removeItem("token");
}

export async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}