/** Return a human-readable response from a Supabase Edge Function error. */
export async function extractFunctionError(error:unknown):Promise<string>{
 if(!error||typeof error!=="object")return "Ismeretlen Edge Function hiba.";
 const e=error as {message?:string;context?:Response};
 if(e.context){try{
  const payload=await e.context.clone().json();
  if(typeof payload?.error==="string")return payload.error;
  if(typeof payload?.message==="string")return payload.message;
 }catch{/* A network error may not contain JSON. */}
 }
 return e.message||"Ismeretlen Edge Function hiba.";
}
