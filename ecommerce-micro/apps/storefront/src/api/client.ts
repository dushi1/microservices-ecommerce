import { ROUTES, type ApiError } from "@ecommerce/contracts/rest";

const BASE = "";

const tokens = {
  access: null as string | null,
  refresh: null as string | null,
};

/**
 * Token storage strategy:
 * - localStorage holds ONLY the refresh token (survives tab close; revocable server-side).
 * - The access token lives in memory per tab (dies with the tab; unrevokable, so never persisted).
 * - All tabs of the same browser share the ONE session via BroadcastChannel:
 *   whichever tab logs in/refreshes publishes the new pair, the others adopt it.
 * - Rotation (single-use refresh tokens) makes concurrent refreshes dangerous:
 *   two tabs refreshing "simultaneously" would revoke each other's tokens and
 *   log each other out. navigator.locks (Web Locks API) is the cross-tab mutex
 *   that serializes refreshes; inside the lock we always re-read the CURRENT
 *   refresh token from localStorage, because another tab may have just rotated it.
 */
const REFRESH_KEY = "ecommerce.refreshToken";
tokens.refresh = localStorage.getItem(REFRESH_KEY);

type AuthMessage =
  | { type: "tokens"; access: string; refresh: string }
  | { type: "logout" };

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("ecommerce.auth") : null;

channel?.addEventListener("message", (e: MessageEvent<AuthMessage>) => {
  if (e.data.type === "tokens") {
    tokens.access = e.data.access;
    tokens.refresh = e.data.refresh;
  } else {
    tokens.access = null;
    tokens.refresh = null;
    localStorage.removeItem(REFRESH_KEY);
  }
});

function broadcast(msg: AuthMessage) {
  channel?.postMessage(msg);
}

/** Subscribe other parts of the app (e.g. AuthContext) to cross-tab auth changes. */
export function onAuthEvent(cb: (msg: AuthMessage) => void): () => void {
  const handler = (e: MessageEvent<AuthMessage>) => cb(e.data);
  channel?.addEventListener("message", handler);
  return () => channel?.removeEventListener("message", handler);
}

export function setTokens(access: string, refresh: string) {
  tokens.access = access;
  tokens.refresh = refresh;
  localStorage.setItem(REFRESH_KEY, refresh);
  broadcast({ type: "tokens", access, refresh });
}

export function clearTokens() {
  tokens.access = null;
  tokens.refresh = null;
  localStorage.removeItem(REFRESH_KEY);
  broadcast({ type: "logout" });
}

export function hasRefreshToken() {
  return tokens.refresh !== null || localStorage.getItem(REFRESH_KEY) !== null;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body) headers["Content-Type"] = "application/json";
  if (tokens.access) headers["Authorization"] = `Bearer ${tokens.access}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = body as ApiError | null;
    if (res.status === 401 && tokens.refresh && retry) {
      const refreshed = await tryRefresh();
      if (refreshed) return api<T>(path, options, false); // retry once, never loop
    }
    throw new ApiRequestError(
      res.status,
      err?.error?.code ?? "UNKNOWN",
      err?.error?.message ?? `Request failed with ${res.status}`,
    );
  }
  return body as T;
}

/** Boot-time session restore: exchange the persisted refresh token for a fresh access token. */
export function restoreSession(): Promise<boolean> {
  return localStorage.getItem(REFRESH_KEY) ? tryRefresh() : Promise.resolve(false);
}

/** Cross-tab mutex so exactly one tab refreshes at a time. */
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (!("locks" in navigator)) return fn();
  return navigator.locks.request("ecommerce.auth.refresh", fn);
}

async function tryRefresh(): Promise<boolean> {
  return withRefreshLock(async () => {
    // Re-read from storage INSIDE the lock: another tab may have rotated the
    // token since this tab last synced. localStorage is the shared truth.
    const current = localStorage.getItem(REFRESH_KEY);
    if (!current) {
      tokens.access = null;
      tokens.refresh = null;
      return false;
    }
    tokens.refresh = current;

    const res = await fetch(`${BASE}${ROUTES.auth.refresh}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: current }),
    });
    if (!res.ok) {
      tokens.access = null;
      tokens.refresh = null;
      localStorage.removeItem(REFRESH_KEY);
      broadcast({ type: "logout" });
      return false;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    tokens.access = data.accessToken;
    tokens.refresh = data.refreshToken;
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    broadcast({ type: "tokens", access: data.accessToken, refresh: data.refreshToken });
    return true;
  });
}
