import {NextResponse} from "next/server";

export const dynamic="force-dynamic";
const URL="https://novenyvedoszer.nebih.gov.hu/Engedelykereso/Kereso";
const H={"user-agent":"Agrar-Mentor/1.0 catalog-integration-probe","accept":"text/html,application/xhtml+xml"};
function decode(v:string){return v.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))}
function attrs(tag:string){const out:Record<string,string>={};for(const m of tag.matchAll(/([:\w$-]+)\s*=\s*["']([^"']*)["']/g))out[m[1].toLowerCase()]=decode(m[2]);return out}
function strip(s:string){return decode(s.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim())}
function hidden(html:string){const body=new URLSearchParams();for(const m of html.matchAll(/<input\b([^>]*)>/gi)){const a=attrs(m[1]);if(a.name&&a.type==="hidden")body.set(a.name,a.value||"")}return body}
async function post(body:URLSearchParams,cookie:string){return fetch(URL,{method:"POST",cache:"no-store",redirect:"follow",headers:{...H,"content-type":"application/x-www-form-urlencoded",...(cookie?{cookie}:{})},body:body.toString()})}

export async function GET(){
 try{
  const first=await fetch(URL,{cache:"no-store",headers:H});const start=await first.text();const cookie=first.headers.get("set-cookie")?.split(";")[0]||"";
  const search=hidden(start);search.set("ctl00$ContentPlaceHolder1$SzernevTextControl","Karate Zeon 5 CS");search.set("ctl00$ContentPlaceHolder1$KeresesButton","Keresés");
  const second=await post(search,cookie);const results=await second.text();
  const select=hidden(results);select.set("__EVENTTARGET","ctl00$ContentPlaceHolder1$NovszerGridView");select.set("__EVENTARGUMENT","Select$22");select.delete("ctl00$ContentPlaceHolder1$KeresesButton");
  const third=await post(select,cookie);const detail=await third.text();const text=strip(detail);const terms=["Forgalmazási kategória","Kultúra","Károsító","Dózis","Élelmezés-egészségügyi várakozási idő","Engedélyszám","Hatóanyag","Karate Zeon"];
  const excerpts=terms.map(term=>{const p=text.toLowerCase().indexOf(term.toLowerCase());return{term,excerpt:p>=0?text.slice(Math.max(0,p-300),p+2200):""}}).filter(x=>x.excerpt);
  const links=[...detail.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>{const a=attrs(m[1]);return{href:a.href||"",onclick:a.onclick||"",text:strip(m[2])}}).filter(x=>/pdf|okirat|dokument|enged|karate/i.test(`${x.href} ${x.onclick} ${x.text}`)).slice(0,100);
  const relevantInputs=[...detail.matchAll(/<input\b([^>]*)>/gi)].map(m=>attrs(m[1])).filter(a=>/okirat|novszer|kultura|karosito|forgal|dozis|elelm/i.test(`${a.name||""} ${a.id||""} ${a.value||""}`)).slice(0,150);
  return NextResponse.json({ok:first.ok&&second.ok&&third.ok,statuses:[first.status,second.status,third.status],searchContains:/Karate Zeon/i.test(results),detailContains:/Karate Zeon/i.test(detail),detailLength:detail.length,excerpts,links,relevantInputs});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:502})}
}
