import {createServerClient} from "@supabase/ssr";
import {NextResponse,type NextRequest} from "next/server";

const protectedPrefixes=["/dashboard","/admin","/farms","/fields","/map","/operations","/tasks","/team","/dispatch","/machines","/work","/timeline","/documents","/invoices","/messages","/notifications"];

export async function middleware(request:NextRequest){
 let response=NextResponse.next({request});
 const pathname=request.nextUrl.pathname;
 const protectedRoute=protectedPrefixes.some(prefix=>pathname===prefix||pathname.startsWith(`${prefix}/`));

 // Public routes do not need an auth/network round-trip in middleware.
 if(!protectedRoute)return response;

 const supabase=createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {cookies:{
   getAll(){return request.cookies.getAll()},
   setAll(cookiesToSet){
    cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
    response=NextResponse.next({request});
    cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   }
  }}
 );

 // Middleware only refreshes/checks authentication. Role, ownership and
 // membership authorization stays in the server pages/actions, where it
 // cannot block every request at the routing layer.
 const{data:{user}}=await supabase.auth.getUser();
 if(!user){
  const url=request.nextUrl.clone();
  url.pathname="/login";
  url.searchParams.set("next",`${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
 }
 return response;
}

export const config={matcher:["/dashboard/:path*","/admin/:path*","/farms/:path*","/fields/:path*","/map/:path*","/operations/:path*","/tasks/:path*","/team/:path*","/dispatch/:path*","/machines/:path*","/work/:path*","/timeline/:path*","/documents/:path*","/invoices/:path*","/messages/:path*","/notifications/:path*"]};
