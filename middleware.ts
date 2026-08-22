import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = [
  "/dashboard",
  "/admin",
  "/farms",
  "/fields",
  "/map",
  "/tasks",
  "/timeline",
  "/documents",
  "/invoices",
  "/messages",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const protectedRoute = protectedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (protectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (!user) return response;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdvisor = profile?.role === "advisor";

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isAdvisor) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (pathname === "/dashboard" && isAdvisor) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const fieldMatch = pathname.match(/^\/fields\/([^/]+)$/);
  if (fieldMatch && !isAdvisor) {
    const fieldId = decodeURIComponent(fieldMatch[1]);
    const { data: field } = await supabase.from("fields").select("farm_id").eq("id", fieldId).maybeSingle();
    if (!field) {
      const url = request.nextUrl.clone();
      url.pathname = "/fields";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const { data: farm } = await supabase.from("farms").select("owner_id").eq("id", field.farm_id).maybeSingle();
    if (!farm || farm.owner_id !== user.id) {
      const url = request.nextUrl.clone();
      url.pathname = "/fields";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
