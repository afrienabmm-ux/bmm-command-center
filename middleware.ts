import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password"];
// Customer-facing membership sign-up — no staff login needed, so every
// path under /join is public regardless of query string.
const PUBLIC_PREFIXES = ["/join"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isJoinPage = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isPublic = PUBLIC_PATHS.includes(pathname) || isJoinPage;

  // The old shared "Field Scanner" account (no-login /scan link) is no
  // longer auto-signed-in — mechanics now get their own individual login
  // (Mechanic role, see lib/permissions.ts), so each phone/session is
  // actually tied to a real person instead of everyone sharing one
  // account's session (which was also the likely cause of unexpected
  // logouts — multiple devices rotating the same refresh token fight each
  // other). Left in place only as a defense-in-depth: if that account is
  // ever signed into directly, it's still locked to /scan and nothing else.
  if (user?.email === process.env.FIELD_SCANNER_EMAIL && pathname !== "/scan" && !pathname.startsWith("/scan/")) {
    return NextResponse.redirect(new URL("/scan", request.url));
  }

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // /login and /signup bounce a signed-in user straight to the dashboard,
  // but /join stays open even when signed in — staff should be able to
  // open their own sign-up link to demo or test it.
  if (user && isPublic && !isJoinPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isJoinPage) {
    return response;
  }

  if (user && pathname !== "/pending") {
    const { data: profile } = await supabase
      .from("cc_user_profiles")
      .select("status")
      .eq("id", user.id)
      .single();

    if (profile?.status !== "approved") {
      return NextResponse.redirect(new URL("/pending", request.url));
    }
  }

  if (user && pathname === "/pending") {
    const { data: profile } = await supabase
      .from("cc_user_profiles")
      .select("status")
      .eq("id", user.id)
      .single();

    if (profile?.status === "approved") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
