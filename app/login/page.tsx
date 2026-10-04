import {redirect} from "next/navigation";
function safeNext(v:string|undefined){return v&&v.startsWith("/")&&!v.startsWith("//")?v:null}
export default async function LoginPage({searchParams}:{searchParams:Promise<{next?:string}>}){const p=await searchParams;const next=safeNext(p.next);redirect(next?`/?login=1&next=${encodeURIComponent(next)}`:"/?login=1")}
