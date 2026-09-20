import {
  ROUTES,
  type AuthResponse,
  type MeResponse,
} from "@ecommerce/contracts/rest";
import { api, setTokens, clearTokens } from "./client";

export async function register(input: { email: string; password: string; displayName: string }) {
  const data = await api<AuthResponse>(ROUTES.auth.register, {
    method: "POST",
    body: JSON.stringify(input),
  });
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function login(input: { email: string; password: string }) {
  const data = await api<AuthResponse>(ROUTES.auth.login, {
    method: "POST",
    body: JSON.stringify(input),
  });
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export function logout() {
  clearTokens();
}

export function fetchMe() {
  return api<MeResponse>(ROUTES.auth.me);
}
