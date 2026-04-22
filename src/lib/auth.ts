"use server";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { syncSubscriptionStatusForUser } from "@/lib/services";

type SessionPayload = {
  userId: string;
  role: "USER" | "ADMIN";
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return new TextEncoder().encode(secret);
}

export async function setSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  await syncSubscriptionStatusForUser(session.userId);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      subscription: true,
      charity: true,
      scores: { orderBy: { scoreDate: "desc" } },
      drawResults: { orderBy: { createdAt: "desc" }, include: { draw: true } },
      notifications: { orderBy: { createdAt: "desc" }, take: 8 },
      donations: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return session;
}
