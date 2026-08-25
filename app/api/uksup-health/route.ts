import {NextResponse} from "next/server";

export const dynamic="force-dynamic";
export const maxDuration=30;

export async function GET(){
 const urls=["https://www.uksup.sk/storage/app/uploads/public/604/080/af4/604080af43e18263270214.csv","https://beta.uksup.sk/storage/app/uploads/public/604/080/af4/604080af43e18263270214.csv"];
 const attempts:any[]=[];
 for(const url of urls){
  try{
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
   const r=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{"user-agent":"Agrar-Mentor/1.0 health-probe","accept":"text/csv,text/plain,*/*"}});clearTimeout(timer);
   const text=r.ok?await r.text():"";
   attempts.push({host:new URL(url).host,status:r.status,ok:r.ok,bytes:text.length});
   if(r.ok&&text.length>100)return NextResponse.json({ok:true,source:new URL(url).host,status:r.status,bytes:text.length});
  }catch(e){attempts.push({host:new URL(url).host,ok:false,error:e instanceof Error?e.name:"network_error"})}
 }
 return NextResponse.json({ok:false,attempts},{status:503});
}
