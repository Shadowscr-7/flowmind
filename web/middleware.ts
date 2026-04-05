import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession reads from cookies — no network call, always reliable
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isPublic =
    pathname === "/" ||
    isAuthPage ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/_next");

  // Helper: redirect while preserving session cookies
  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) =>
      res.cookies.set(c.name, c.value)
    );
    return res;
  }

  // Logged-in user hitting auth pages or landing → go to dashboard
  if (session && (isAuthPage || pathname === "/")) {
    return redirectTo("/dashboard");
  }

  // Unauthenticated user hitting protected route → go to login
  if (!session && !isPublic) {
    return redirectTo("/login");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|png)$).*)",
  ],
};
