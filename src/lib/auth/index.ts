import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "../db";
import { UserRole } from "@prisma/client";

const SESSION_COOKIE_NAME = "annapurna_session";
const DEV_SESSION_SECRET = "annapurna_rebuilt_development_session_secret_min_32_chars_ok!";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        "FATAL_AUTH_CONFIG: SESSION_SECRET must be explicitly configured with at least 32 characters in production."
      );
    }
    return secret.trim();
  }

  // Development / Test environment
  if (secret && secret.trim().length >= 32) {
    return secret.trim();
  }

  return DEV_SESSION_SECRET;
}

export const SessionPayloadSchema = z.object({
  userId: z.string().min(1).max(128),
  email: z.string().email().max(256),
  role: z.nativeEnum(UserRole),
  exp: z.number().int().finite().positive(),
});

export type SessionPayload = z.infer<typeof SessionPayloadSchema>;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
  expiresInHours = 24
): string {
  const secret = getSessionSecret();
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + expiresInHours * 3600;

  const validated = SessionPayloadSchema.parse({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    exp,
  });

  const data = Buffer.from(JSON.stringify(validated)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    if (!data || !signature) return null;

    const secret = getSessionSecret();
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    // Constant-time length and signature check
    if (sigBuf.length !== expBuf.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const jsonStr = Buffer.from(data, "base64url").toString("utf8");
    const rawObj = JSON.parse(jsonStr);

    const parseResult = SessionPayloadSchema.safeParse(rawObj);
    if (!parseResult.success) {
      return null;
    }

    const payload = parseResult.data;
    const nowSec = Math.floor(Date.now() / 1000);

    // Fail closed if expired (exact boundary inclusive)
    if (payload.exp <= nowSec) {
      return null;
    }

    // Maximum token lifetime bound (30 days) to prevent infinite tokens
    if (payload.exp > nowSec + 30 * 24 * 3600) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getSession(req?: Request): Promise<SessionPayload | null> {
  try {
    if (req) {
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
        if (match && match[1]) {
          return verifySessionToken(match[1]);
        }
      }
    }
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getCurrentUser(req?: Request) {
  const session = await getSession(req);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user) return null;

  // Stale session invalidation: if user's role changed in the database,
  // invalidate the session immediately to prevent privilege escalation.
  if (user.role !== session.role) {
    return null;
  }

  return user;
}

export async function requireAuth(req?: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireRole(allowedRoles: UserRole[], req?: Request) {
  const user = await requireAuth(req);
  if (!allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export const authCookieConfig = {
  name: SESSION_COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 24 * 3600, // 24 hours
  },
};
