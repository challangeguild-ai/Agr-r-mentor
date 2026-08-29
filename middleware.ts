import {NextResponse,type NextRequest} from "next/server";

const protectedPrefixes=["/dashboard","/daily-work","/admin","/system-admin","/farms","/fields","/map","/operations","/tasks","/team","/dispatch","/machines","/work","/timeline","/documents","/invoices","/messages","/notifications"];

export function middleware(request:NextRequest){
 const pathname=request.nextUrl.pathname;
 const protectedRoute=protectedPrefixes.some(prefix=>pathname===prefix||pathname.startsWith(`${prefix}/`));
 if(!protectedRoute)return NextResponse.next();
 // Routing middleware only performs a cheap cookie presence check. Every page
 // and server action performs authoritative Supabase authentication and role checks.
 const hasAuthCookie=request.cookies.getAll().some(({name,value})=>name.startsWith("sb-")&&name.includes("auth-token")&&Boolean(value));
 if(!hasAuthCookie){const url=request.nextUrl.clone();url.pathname="/login";url.searchParams.set("next",`${pathname}${request.nextUrl.search}`);return NextResponse.redirect(url)}
 return NextResponse.next();
}

export const config={matcher:["/dashboard/:path*","/daily-work/:path*","/admin/:path*","/system-admin/:path*","/farms/:path*","/fields/:path*","/map/:path*","/operations/:path*","/tasks/:path*","/team/:path*","/dispatch/:path*","/machines/:path*","/work/:path*","/timeline/:path*","/documents/:path*","/invoices/:path*","/messages/:path*","/notifications/:path*"]};