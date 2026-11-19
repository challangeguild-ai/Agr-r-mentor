export type ContactInput={contact_type:"phone"|"email";label:string;value:string;is_primary:boolean};

function normalizePhone(value:string){
 const trimmed=value.trim();
 return (trimmed.startsWith("+")?"+":"")+trimmed.replace(/\D/g,"");
}

export function parseContacts(raw:FormDataEntryValue|null):ContactInput[]{
 let parsed:unknown;
 try{parsed=JSON.parse(String(raw||"[]"))}
 catch{throw new Error("A kapcsolattartási adatok formátuma hibás.")}
 if(!Array.isArray(parsed))throw new Error("A kapcsolattartási adatok formátuma hibás.");
 if(parsed.length>30)throw new Error("Legfeljebb 30 elérhetőség adható meg egyszerre.");
 const items:ContactInput[]=parsed.map((entry:unknown)=>{
  const row=entry as Record<string,unknown>|null;
  const contact_type:ContactInput["contact_type"]=row?.contact_type==="email"?"email":"phone";
  const rawValue=String(row?.value||"");
  return{
   contact_type,
   label:String(row?.label||"").trim(),
   value:contact_type==="email"?rawValue.trim().toLowerCase():normalizePhone(rawValue),
   is_primary:!!row?.is_primary
  };
 }).filter(item=>item.value);
 const seen=new Set<string>();
 const unique=items.filter(item=>{
  const key=`${item.contact_type}:${item.value}`;
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
 if(unique.length&&!unique.some(item=>item.is_primary))unique[0].is_primary=true;
 let primaryUsed=false;
 return unique.map(item=>{
  if(item.is_primary&&!primaryUsed){primaryUsed=true;return item}
  return{...item,is_primary:false};
 });
}

export function validateContacts(items:ContactInput[],required=true){
 if(required&&!items.some(item=>item.contact_type==="phone"))throw new Error("Legalább egy telefonszám megadása kötelező.");
 if(required&&!items.some(item=>item.contact_type==="email"))throw new Error("Legalább egy e-mail cím megadása kötelező.");
 for(const item of items){
  if(item.contact_type==="phone"){
   if(!item.label)throw new Error("Minden telefonszámhoz add meg a kapcsolattartó nevét.");
   if(!/^\+?\d{7,15}$/.test(item.value))throw new Error(`Érvénytelen telefonszám: ${item.value}`);
  }
  if(item.contact_type==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.value))throw new Error(`Érvénytelen e-mail cím: ${item.value}`);
  if(item.value.length>250||item.label.length>120)throw new Error("Az egyik kapcsolattartási adat túl hosszú.");
 }
}
