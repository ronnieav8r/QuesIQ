import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  accountPasswordCredentials,
  platformUserProfiles,
  users,
} from "@/server/db/schema";

const scrypt = promisify(scryptCallback);
const passwordMinLength = 10;
const passwordMaxLength = 128;
const hashLength = 64;
const rateLimitWindowMs = 15 * 60 * 1000;

const globalForPasswordAuth = globalThis as typeof globalThis & {
  passwordAuthRateLimits?: Map<string, { count: number; resetAt: number }>;
};

export type PasswordAccountInput = {
  confirmPassword?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  preferredName?: string;
};

export type PasswordSignInInput = {
  email?: unknown;
  password?: unknown;
};

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

export function normalizeAccountEmail(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function checkRateLimit(key: string, maxAttempts: number) {
  const now = Date.now();
  const bucket = globalForPasswordAuth.passwordAuthRateLimits ?? new Map();
  globalForPasswordAuth.passwordAuthRateLimits = bucket;
  const current = bucket.get(key);

  if (!current || current.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return true;
  }

  if (current.count >= maxAttempts) {
    return false;
  }

  current.count += 1;
  bucket.set(key, current);

  return true;
}

export function validatePassword(password: string) {
  if (password.length < passwordMinLength) {
    return `Password must be at least ${passwordMinLength} characters.`;
  }

  if (password.length > passwordMaxLength) {
    return `Password must be ${passwordMaxLength} characters or fewer.`;
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number.";
  }

  return undefined;
}

export function parsePasswordAccountInput(body: unknown): PasswordAccountInput | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const candidate = body as Record<string, unknown>;

  return {
    confirmPassword:
      typeof candidate.confirmPassword === "string" ? candidate.confirmPassword : undefined,
    email: normalizeAccountEmail(candidate.email),
    firstName: cleanName(candidate.firstName),
    lastName: cleanName(candidate.lastName),
    password: typeof candidate.password === "string" ? candidate.password : undefined,
    preferredName: cleanName(candidate.preferredName),
  };
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = (await scrypt(password, salt, hashLength)) as Buffer;

  return `scrypt:v1:${salt}:${hash.toString("base64url")}`;
}

async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, version, salt, storedHash] = encodedHash.split(":");

  if (algorithm !== "scrypt" || version !== "v1" || !salt || !storedHash) {
    return false;
  }

  const candidate = (await scrypt(password, salt, hashLength)) as Buffer;
  const stored = Buffer.from(storedHash, "base64url");

  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

function displayName(input: PasswordAccountInput) {
  return (
    input.preferredName ||
    [input.firstName, input.lastName].filter(Boolean).join(" ") ||
    input.email ||
    undefined
  );
}

export async function createPasswordAccount(input: PasswordAccountInput) {
  const email = normalizeAccountEmail(input.email);
  const password = input.password ?? "";

  if (!isValidEmail(email)) {
    throw new Error("Enter a valid email address.");
  }

  if (!checkRateLimit(`create:${email}`, 5)) {
    throw new Error("Too many account attempts. Wait a few minutes and try again.");
  }

  if (password !== input.confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    throw new Error(passwordError);
  }

  const [existingCredential] = await getDb()
    .select({ userId: accountPasswordCredentials.userId })
    .from(accountPasswordCredentials)
    .where(eq(accountPasswordCredentials.email, email))
    .limit(1);

  if (existingCredential) {
    throw new Error("An account already exists for this email. Sign in instead.");
  }

  const now = new Date();
  const passwordHash = await hashPassword(password);
  const [existingUser] = await getDb()
    .select({
      emailVerified: users.emailVerified,
      id: users.id,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser?.emailVerified) {
    throw new Error("An account already exists for this email. Sign in instead.");
  }

  const userId = existingUser?.id ?? crypto.randomUUID();

  await getDb().transaction(async (tx) => {
    if (!existingUser) {
      await tx.insert(users).values({
        email,
        emailVerified: null,
        id: userId,
        name: displayName({ ...input, email }),
      });
    }

    await tx.insert(accountPasswordCredentials).values({
      email,
      passwordHash,
      passwordUpdatedAt: now,
      updatedAt: now,
      userId,
    });

    await tx
      .insert(platformUserProfiles)
      .values({
        firstName: cleanName(input.firstName),
        lastName: cleanName(input.lastName),
        preferredName: cleanName(input.preferredName),
        updatedAt: now,
        userId,
      })
      .onConflictDoUpdate({
        set: {
          firstName: cleanName(input.firstName),
          lastName: cleanName(input.lastName),
          preferredName: cleanName(input.preferredName),
          updatedAt: now,
        },
        target: platformUserProfiles.userId,
      });
  });

  return {
    email,
    emailVerificationRequired: true,
    userId,
  };
}

export async function verifyPasswordCredentials(input: PasswordSignInInput) {
  const email = normalizeAccountEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";

  if (!isValidEmail(email) || !password) {
    return null;
  }

  if (!checkRateLimit(`signin:${email}`, 8)) {
    return null;
  }

  const [credential] = await getDb()
    .select({
      email: accountPasswordCredentials.email,
      emailVerified: users.emailVerified,
      name: users.name,
      passwordHash: accountPasswordCredentials.passwordHash,
      userId: accountPasswordCredentials.userId,
    })
    .from(accountPasswordCredentials)
    .innerJoin(users, eq(users.id, accountPasswordCredentials.userId))
    .where(eq(accountPasswordCredentials.email, email))
    .limit(1);

  if (!credential || !credential.emailVerified) {
    return null;
  }

  const valid = await verifyPassword(password, credential.passwordHash);

  if (!valid) {
    return null;
  }

  return {
    email: credential.email,
    id: credential.userId,
    name: credential.name,
  };
}
