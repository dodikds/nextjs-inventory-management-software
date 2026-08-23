import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_ROUTES = ["/"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith("/api/auth");

  if (!req.auth && !isPublicRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
