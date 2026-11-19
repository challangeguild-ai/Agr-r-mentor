// Shared, runtime-independent helper for Supabase Edge Function email requests.
// Every email must be tied to a persisted business event. Never key by message
// content: edited text must not allow a second send for the same event.
export function normalizeNotificationEventKey(value:unknown):string|null{
 if(typeof value!=="string")return null;
 const key=value.trim();
 return key.length>0&&key.length<=180&&/^[a-zA-Z0-9_:/.-]+$/.test(key)?key:null;
}

export type NotificationEmailIdentity={
 senderId:string;
 recipientId:string;
 recipientEmail:string;
 eventKey:string;
 from:string;
 subject:string;
 message:string;
 link:string;
};

export async function notificationEmailIdempotencyKey(input:NotificationEmailIdentity):Promise<string>{
 // Resend replays the original result for the same key and payload, and
 // refuses a changed payload with HTTP 409. Both prevent an accidental (or
 // malicious) second send for the same logical event within their 24h window.
 const data=JSON.stringify([
  "agrar-email-v1",input.senderId,input.recipientId,input.recipientEmail,input.eventKey,
 ]);
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(data)));
 return "agrar-email-v1-"+Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
}
