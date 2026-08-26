type NotifyAdvisorInput={
 kind:string;
 title:string;
 message?:string|null;
 href?:string|null;
 eventKey?:string|null;
 emailSubject?:string|null;
 emailMessage?:string|null;
};

type NotifyUserInput={
 userId:string;
 kind:string;
 title:string;
 message?:string|null;
 href?:string|null;
 eventKey?:string|null;
 emailSubject?:string|null;
 emailMessage?:string|null;
};

async function sendEmail(supabase:any,userId:string,subject:string,message:string,href:string|null){
 try{
  const{error}=await supabase.functions.invoke("send-notification-email",{body:{target_user_id:userId,subject,message,href:href||"/notifications"}});
  if(error)console.error("E-mail értesítés sikertelen",error);
 }catch(error){console.error("E-mail értesítés sikertelen",error)}
}

export async function notifyAdvisors(supabase:any,input:NotifyAdvisorInput){
 const{data,error}=await supabase.rpc("notify_advisors",{
  p_kind:input.kind,
  p_title:input.title,
  p_message:input.message||null,
  p_href:input.href||null,
  p_event_key:input.eventKey||null,
 });
 if(error){console.error("Szaktanácsadói értesítés létrehozása sikertelen",error);return [] as string[]}
 const recipients=(data??[]).map((x:any)=>String(x.recipient_id||"")).filter(Boolean);
 if(input.emailSubject){for(const id of recipients)await sendEmail(supabase,id,input.emailSubject,input.emailMessage||input.message||input.title,input.href||null)}
 return recipients;
}

export async function notifyUser(supabase:any,input:NotifyUserInput){
 const row={user_id:input.userId,kind:input.kind,title:input.title,message:input.message||null,href:input.href||null,event_key:input.eventKey||null};
 const{error}=await supabase.from("notifications").insert(row);
 if(error&&error.code!=="23505"){console.error("Értesítés létrehozása sikertelen",error);return false}
 if(!error&&input.emailSubject)await sendEmail(supabase,input.userId,input.emailSubject,input.emailMessage||input.message||input.title,input.href||null);
 return !error;
}
