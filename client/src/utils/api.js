/**
 * Standardized API client for RentMate
 * - Always includes credentials so the httpOnly JWT cookie is sent/received
 * - Standardizes JSON handling and error parsing
 */

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch(path, options = {}) {
  const { headers = {}, body, ...customOptions } = options;

  const normalizedPath = path.startsWith("http")
    ? path
    : path.startsWith("/api")
    ? path
    : `/api${path.startsWith("/") ? "" : "/"}${path}`;

  const config = {
    method: options.method || (body ? "POST" : "GET"),
    credentials: "include",
    headers: {
      ...headers,
    },
    ...customOptions,
  };

  if (body !== undefined) {
    if (body instanceof FormData) {
      config.body = body;
    } else {
      config.headers["Content-Type"] = "application/json";
      config.body = typeof body === "string" ? body : JSON.stringify(body);
    }
  }

  const response = await fetch(normalizedPath, config);

  let data = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else if (response.status !== 204) {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" && data) ||
      `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, data);
  }

  return data;
}

export const api = {
  get: (path, options) => apiFetch(path, { ...options, method: "GET" }),
  post: (path, body, options) => apiFetch(path, { ...options, method: "POST", body }),
  put: (path, body, options) => apiFetch(path, { ...options, method: "PUT", body }),
  delete: (path, options) => apiFetch(path, { ...options, method: "DELETE" }),
  patch: (path, body, options) => apiFetch(path, { ...options, method: "PATCH", body }),
};

export default api;
