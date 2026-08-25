import {NextResponse} from "next/server";

export const dynamic="force-dynamic";

export async function GET(){
  const url="https://novenyvedoszer.nebih.gov.hu/Engedelykereso/Kereso";
  try{
    const r=await fetch(url,{cache:"no-store",headers:{"user-agent":"Agrar-Mentor/1.0 catalog-integration-probe","accept":"text/html,application/xhtml+xml"}});
    const html=await r.text();
    const forms=[...html.matchAll(/<form\b([^>]*)>/gi)].map(m=>m[1].trim()).slice(0,10);
    const inputs=[...html.matchAll(/<(?:input|select|button)\b([^>]*)>/gi)].map(m=>{
      const a=m[1];const get=(n:string)=>a.match(new RegExp(`${n}=["']([^"']*)["']`,`i`))?.[1]||"";return{tag:m[0].match(/^<([a-z]+)/i)?.[1]||"",name:get("name"),id:get("id"),type:get("type"),value:get("value"),formaction:get("formaction")};
    }).filter(x=>x.name||x.id||x.formaction).slice(0,250);
    const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1]).slice(0,100);
    const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map(m=>m[1]).filter(x=>/keres|enged|ajax|api/i.test(x)).slice(0,100);
    return NextResponse.json({ok:r.ok,status:r.status,finalUrl:r.url,forms,inputs,scripts,links,htmlLength:html.length});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:502})}
}
