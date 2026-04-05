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

  // IMPORTANT: do not add logic between createServerClient and getUser()
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");

  // Helper: create redirect and ALWAYS copy Supabase session cookies
  function redirect(to: string) {
    const url = request.nextUrl.clone();
    url.pathname = to;
    const res = NextResponse.redirect(url);
    // Copy session cookies so Supabase SSR doesn't corrupt the session
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value);
    });
    return res;
  }

  // Logged-in user hitting auth pages or landing → send to dashboard
  if (user && (isAuthRoute || pathname === "/")) {
    return redirect("/dashboard");
  }

  // Unauthenticated user hitting protected routes → send to login
  const isPublic =
    pathname === "/" ||
    isAuthRoute ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/images");

  if (!user && !isPublic) {
    return redirect("/login");
  }

  // IMPORTANT: return supabaseResponse to preserve session cookies
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|png)$).*)",
  ],
};
