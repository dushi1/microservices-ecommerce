import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import {
  registerRequestSchema,
  loginRequestSchema,
  refreshRequestSchema,
  type AuthResponse,
  type MeResponse,
} from "@ecommerce/contracts";
import { AppError } from "@ecommerce/common";
import { pool } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";
// Note: there is intentionally no refresh-token secret. Refresh tokens are opaque
// random strings, stored sha256-hashed in refresh_tokens and validated by DB lookup —
// that's what makes server-side revocation (logout / rotation) possible.
const ACCESS_TTL = (process.env.ACCESS_TTL ?? "15m") as jwt.SignOptions["expiresIn"];
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS ?? 7);
const ACCESS_TTL_SECONDS = 15 * 60;

interface UserRow {
  user_id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at?: Date;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function issueTokens(user: { user_id: string }, refreshToken?: string): AuthResponse {
  const accessToken = jwt.sign({ sub: user.user_id }, JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });
  return {
    userId: user.user_id,
    accessToken,
    refreshToken: refreshToken ?? "",
    expiresIn: ACCESS_TTL_SECONDS,
  };
}

async function createRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)",
    [sha256(raw), userId, REFRESH_TTL_DAYS],
  );
  return raw;
}

/** Best-effort: Kafka (MSK on Floci) isn't running in early dev, so emission is skipped unless configured. */
async function emitUserCreated(payload: {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
}) {
  if (!process.env.KAFKA_BROKERS) return;
  try {
    const { EventPublisher } = await import("@ecommerce/events");
    const { Kafka } = await import("kafkajs");
    const kafka = new Kafka({ clientId: "auth-service", brokers: [process.env.KAFKA_BROKERS] });
    const publisher = new EventPublisher(kafka);
    await publisher.publish("user.created", crypto.randomUUID(), payload);
  } catch (err) {
    // Events must never break registration.
    console.warn({ err }, "failed to emit user.created");
  }
}

/** POST /api/v1/auth/register */
export async function register(req: Request, res: Response) {
  const body = registerRequestSchema.parse(req.body);

  // Fast-fail pre-check (nice error UX). NOT the real guard — two concurrent
  // requests can both pass it. The UNIQUE(email) constraint is authoritative:
  // the insert below catches its 23505 violation and returns 409.
  const existing = await pool.query("SELECT 1 FROM users WHERE email = $1", [body.email]);
  if (existing.rowCount) {
    throw new AppError("CONFLICT", "Email already registered");
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  let inserted;
  try {
    inserted = await pool.query<UserRow>(
      "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING user_id, email, password_hash, display_name, created_at",
      [body.email, passwordHash, body.displayName],
    );
  } catch (err) {
    // 23505 = unique_violation: a concurrent request registered this email first.
    if ((err as { code?: string }).code === "23505") {
      throw new AppError("CONFLICT", "Email already registered");
    }
    throw err;
  }
  const user = inserted.rows[0];

  await emitUserCreated({
    userId: user.user_id,
    email: user.email,
    displayName: user.display_name,
    createdAt: user.created_at?.toISOString() ?? new Date().toISOString(),
  });

  const refreshToken = await createRefreshToken(user.user_id);
  res.status(201).json(issueTokens(user, refreshToken));
}

/** POST /api/v1/auth/login */
export async function login(req: Request, res: Response) {
  const body = loginRequestSchema.parse(req.body);

  const found = await pool.query<UserRow>(
    "SELECT user_id, email, password_hash, display_name FROM users WHERE email = $1",
    [body.email],
  );
  const user = found.rows[0];
  const ok = user && (await bcrypt.compare(body.password, user.password_hash));
  if (!ok) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials");
  }

  const refreshToken = await createRefreshToken(user.user_id);
  res.json(issueTokens(user, refreshToken));
}

/** POST /api/v1/auth/refresh — rotates: old token is revoked, a new one is issued. */
export async function refresh(req: Request, res: Response) {
  const body = refreshRequestSchema.parse(req.body);
  const tokenHash = sha256(body.refreshToken);

  const found = await pool.query<{ token_hash: string; user_id: string }>(
    "SELECT token_hash, user_id FROM refresh_tokens WHERE token_hash = $1 AND NOT revoked AND expires_at > now()",
    [tokenHash],
  );
  const stored = found.rows[0];
  if (!stored) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired refresh token");
  }

  await pool.query("UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1", [tokenHash]);
  const user = await pool.query<UserRow>("SELECT * FROM users WHERE user_id = $1", [stored.user_id]);
  const refreshToken = await createRefreshToken(stored.user_id);
  res.json(issueTokens(user.rows[0], refreshToken));
}

/** GET /api/v1/auth/me — requires Authorization: Bearer <accessToken>. */
export async function me(req: Request, res: Response) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "Missing bearer token");
  }
  let userId: string;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    userId = (payload as jwt.JwtPayload).sub as string;
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid or expired access token");
  }

  const found = await pool.query<UserRow>(
    "SELECT user_id, email, display_name FROM users WHERE user_id = $1",
    [userId],
  );
  if (!found.rowCount) {
    throw new AppError("NOT_FOUND", "User not found");
  }
  const user = found.rows[0];
  const profile: MeResponse = {
    userId: user.user_id,
    email: user.email,
    displayName: user.display_name,
  };
  res.json(profile);
}
