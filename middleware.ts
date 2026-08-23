import {NextResponse,type NextRequest} from "next/server";

const protectedPrefixes=["/dashboard","/admin","/farms","/fields","/map","/operations","/tasks","/team","/dispatch","/machines","/work","/timeline","/documents","/invoices","/messages","/notifications"];

export function middleware(request:NextRequest){
 const pathname=request.nextUrl.pathname;
 const protectedRoute=protectedPrefixes.some(prefix=>pathname===prefix||pathname.startsWith(`${prefix}/`));
 if(!protectedRoute)return NextResponse.next();

 // Do not call Supabase from routing middleware. A network call here can block
 // the entire application before the page is allowed to render. The server
 // pages/actions perform the authoritative authentication and authorization.
 const hasAuthCookie=request.cookies.getAll().some(({name,value})=>name.startsWith("sb-")&&name.includes("auth-token")&&Boolean(value));
 if(!hasAuthCookie){
  const url=request.nextUrl.clone();
  url.pathname="/login";
  url.searchParams.set("next",`${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
 }
 return NextResponse.next();
}

export const config={matcher:["/dashboard/:path*","/admin/:path*","/farms/:path*","/fields/:path*","/map/:path*","/operations/:path*","/tasks/:path*","/team/:path*","/dispatch/:path*","/machines/:path*","/work/:path*","/timeline/:path*","/documents/:path*","/invoices/:path*","/messages/:path*","/notifications/:path*"]};
