import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@/lib/constants";

const protectedPaths = ["/dashboard", "/admin"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = protectedPaths.some((path) => pathname.startsWith(path));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const secret = process.env.JWT_SECRET ?? "";
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
