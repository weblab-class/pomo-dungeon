const envBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const isLegacyLocal =
  envBaseUrl === 'http://localhost:3001' ||
  envBaseUrl === 'http://127.0.0.1:3001';
const API_BASE_URL = isLegacyLocal ? '' : envBaseUrl;

export const getApiBaseUrl = () => API_BASE_URL;

export const postJson = async (path, body, options = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: JSON.stringify(body || {}),
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text ? `Request failed (${res.status}): ${text}` : `Request failed: ${res.status}`);
  }
  return res.json();
};

export const getJson = async (path, options = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text ? `Request failed (${res.status}): ${text}` : `Request failed: ${res.status}`);
  }
  return res.json();
};
