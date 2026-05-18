const DEFAULT_API_BASE = "http://localhost:5000";

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

const getApiBase = () => {
  const configuredUrl = import.meta.env.VITE_API_URL || DEFAULT_API_BASE;
  const cleanUrl = trimTrailingSlash(configuredUrl.trim());

  return cleanUrl.replace(/\/api\/(users|expenses)$/i, "");
};

export const API_BASE = getApiBase();
export const USERS_API = `${API_BASE}/api/users`;
export const EXPENSES_API = `${API_BASE}/api/expenses`;

