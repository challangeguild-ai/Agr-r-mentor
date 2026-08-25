import {NextResponse} from "next/server";

export const dynamic="force-dynamic";
const URL="https://novenyvedoszer.nebih.gov.hu/Engedelykereso/Kereso";
function decode(v:string){return v.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))}
function attrs(tag:string){const out:Record<string,string>={};for(const m of tag.matchAll(/([:\w$-]+)\s*=\s*["']([^"']*)["']/g))out[m[1].toLowerCase()]=decode(m[2]);return out}
function strip(s:string){return decode(s.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim())}

export async function GET(){
 try{
  const first=await fetch(URL,{cache:"no-store",headers:{"user-agent":"Agrar-Mentor/1.0 catalog-integration-probe","accept":"text/html,application/xhtml+xml"}});const html=await first.text();
  const body=new URLSearchParams();for(const m of html.matchAll(/<input\b([^>]*)>/gi)){const a=attrs(m[1]);if(!a.name)continue;if(a.type==="hidden")body.set(a.name,a.value||"");}
  body.set("ctl00$ContentPlaceHolder1$SzernevTextControl","Karate Zeon 5 CS");body.set("ctl00$ContentPlaceHolder1$KeresesButton","Keresés");
  const cookie=first.headers.get("set-cookie")?.split(";")[0]||"";
  const second=await fetch(URL,{method:"POST",cache:"no-store",redirect:"follow",headers:{"user-agent":"Agrar-Mentor/1.0 catalog-integration-probe","content-type":"application/x-www-form-urlencoded","accept":"text/html,application/xhtml+xml",...(cookie?{cookie}:{})},body:body.toString()});const result=await second.text();
  const text=strip(result);const pos=text.toLowerCase().indexOf("karate zeon");const excerpt=pos>=0?text.slice(Math.max(0,pos-500),pos+3000):text.slice(0,1500);
  const links=[...result.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>{const a=attrs(m[1]);return{href:a.href||"",onclick:a.onclick||"",text:strip(m[2])}}).filter(x=>/karate|document|okirat|info|javascript|enged/i.test(`${x.href} ${x.onclick} ${x.text}`)).slice(0,100);
  const resultInputs=[...result.matchAll(/<input\b([^>]*)>/gi)].map(m=>attrs(m[1])).filter(a=>/novszer|okirat|info|result|grid|kereses/i.test(`${a.name||""} ${a.id||""}`)).slice(0,150);
  return NextResponse.json({ok:first.ok&&second.ok,getStatus:first.status,postStatus:second.status,postUrl:second.url,cookie:!!cookie,containsProduct:/Karate Zeon/i.test(result),excerpt,links,resultInputs,resultLength:result.length});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:502})}
}
