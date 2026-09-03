import { auth } from "@/auth";

// Every export route is a route.ts, not a page.tsx — it isn't wrapped by
// (dashboard)/layout.tsx's own "redirect to / if no session" check, so
// without this an unauthenticated request straight to the URL would
// successfully download real business data. Shared here so all four export
// routes enforce the same thing the same way.
export async function requireReportsSession(): Promise<Response | null> {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
