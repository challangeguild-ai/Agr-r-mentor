// Sending mail requires an existing business event AND its saved in-app
// notification. A valid login or an arbitrary recipient ID is not enough.
export type NotificationEvent={kind:"task"|"inspection"|"report";id:string;action:string};

const uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const eventPattern=new RegExp(`^(task|inspection|report):(${uuid}):([a-z-]+)$`);
const taskActions=new Set(["dispatch","advisor","operation-plan","report","submitted"]);
const reportActions=new Set(["created","reply","closed"]);

export function parseEmailEvent(value:string):NotificationEvent|null{
 const match=eventPattern.exec(value);
 if(!match)return null;
 const [,kind,id,action]=match;
 if((kind==="task"&&!taskActions.has(action))
  ||(kind==="inspection"&&action!=="farmer")
  ||(kind==="report"&&!reportActions.has(action)))return null;
 return{kind:kind as NotificationEvent["kind"],id,action};
}

type Database={from:(table:string)=>any};

export async function authorizeNotificationEmail(
 admin:Database,senderId:string,targetId:string,eventKey:string,
 senderRole:string|null,senderSystemRole:string|null,
 targetRole:string|null,targetSystemRole:string|null
):Promise<boolean>{
 const event=parseEmailEvent(eventKey);
 if(!event||!senderId||!targetId)return false;
 const senderIsAdvisor=senderRole==="advisor"&&senderSystemRole!=="admin";
 if((event.kind==="inspection"||event.kind==="report"&&event.action!=="created"
  ||event.kind==="task"&&["advisor","operation-plan","report"].includes(event.action))
  &&!senderIsAdvisor)return false;

 const advisorRecipient=targetRole==="advisor"&&targetSystemRole!=="admin";
 const notificationKey=advisorRecipient&&
  ((event.kind==="task"&&event.action==="submitted")||(event.kind==="report"&&event.action==="created"))
  ?`${eventKey}:advisor:${targetId}`:eventKey;
 const {data:notice,error:noticeError}=await admin.from("notifications")
  .select("id").eq("user_id",targetId).eq("event_key",notificationKey).maybeSingle();
 if(noticeError||!notice)return false;

 if(event.kind==="task"){
  const {data:task,error}=await admin.from("tasks")
   .select("created_by,assigned_to,status").eq("id",event.id).maybeSingle();
  if(error||!task)return false;
  if(event.action==="submitted")return advisorRecipient&&task.assigned_to===senderId&&task.status==="submitted";
  return task.created_by===senderId&&task.assigned_to===targetId;
 }
 if(event.kind==="inspection"){
  const {data:inspection,error}=await admin.from("inspections")
   .select("advisor_id,field_id").eq("id",event.id).maybeSingle();
  if(error||!inspection||inspection.advisor_id!==senderId)return false;
  const {data:field,error:fieldError}=await admin.from("fields")
   .select("farm_id").eq("id",inspection.field_id).maybeSingle();
  if(fieldError||!field)return false;
  const {data:farm,error:farmError}=await admin.from("farms")
   .select("owner_id").eq("id",field.farm_id).maybeSingle();
  return !farmError&&farm?.owner_id===targetId;
 }
 const {data:report,error}=await admin.from("farmer_reports")
  .select("farmer_id,status,replied_by").eq("id",event.id).maybeSingle();
 if(error||!report)return false;
 if(event.action==="created")return advisorRecipient&&report.farmer_id===senderId;
 if(event.action==="reply")return report.farmer_id===targetId&&report.replied_by===senderId&&report.status==="reviewed";
 return report.farmer_id===targetId&&report.status==="closed";
}
