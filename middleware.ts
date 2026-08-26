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

  // /scan is the phone jobsheet-scanner link, handed out to field staff —
  // no login screen. Anyone opening it is silently signed in as a shared
  // "Field Scanner" account instead, so the save/upload actions underneath
  // (which all require a real session) still work.
  const isScanPage = pathname === "/scan" || pathname.startsWith("/scan/");
  if (isScanPage) {
    if (!user) {
      const email = process.env.FIELD_SCANNER_EMAIL;
      const password = process.env.FIELD_SCANNER_PASSWORD;
      if (email && password) {
        await supabase.auth.signInWithPassword({ email, password });
      }
    }
    return response;
  }

  // The Field Scanner account only ever exists to drive /scan — whoever
  // has that link should never be able to reach anything else just by
  // typing a different URL, even though the account itself is a real,
  // approved session that would otherwise pass every check below.
  if (user?.email === process.env.FIELD_SCANNER_EMAIL) {
    return NextResponse.redirect(new URL("/scan", request.url));
  }

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
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
