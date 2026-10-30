/**
 * Shared Safe HTTP Request Helper
 * Safely handles JSON, plain text, empty bodies (204 No Content),
 * infrastructure timeouts (AbortController), and network failure states.
 */

export interface SafeFetchResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function safeFetch<T = any>(
  input: string | URL | Request,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse<T>> {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (fetchOptions.signal) {
    fetchOptions.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const res = await fetch(input, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 204 No Content or empty body
    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return {
        ok: res.ok,
        status: res.status,
        data: null,
        error: res.ok ? null : `HTTP Error ${res.status}`,
      };
    }

    const contentType = res.headers.get("content-type") || "";
    let data: any = null;
    let errorMessage: string | null = null;

    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
        if (!res.ok) {
          errorMessage = data?.error || data?.message || `Request failed with status ${res.status}`;
        }
      } catch {
        errorMessage = `Failed to parse JSON response from server (Status ${res.status})`;
      }
    } else {
      const text = await res.text();
      if (!res.ok) {
        errorMessage = text.length > 200 ? `${text.slice(0, 200)}...` : text || `HTTP ${res.status}`;
      } else {
        data = text as unknown as T;
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? data : null,
      error: errorMessage,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return {
        ok: false,
        status: 408,
        data: null,
        error: "Request timed out or was aborted by client.",
      };
    }
    return {
      ok: false,
      status: 0,
      data: null,
      error: err.message || "Network failure or server unreachable.",
    };
  }
}
