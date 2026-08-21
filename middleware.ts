import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/signup"];
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
