"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {encodeOperation,operationLabel,operationTypes,type OperationType,type OperationData,OP_EVENT} from "@/lib/operations";

function num(v:FormDataEntryValue|null){const s=String(v||"").trim().replace(",",".");if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null}
function text(v:FormDataEntryValue|null,max:number){return String(v||"").trim().slice(0,max)}
function validDate(v:string){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(`${v}T12:00:00`).getTime())}

async function context(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();return{supabase,user,profile}}

async function assertFieldAccess(supabase:any,userId:string,role:string|undefined,fieldId:string){
  const{data:field}=await supabase.from("fields").select("id,name,farm_id,area_ha,current_crop").eq("id",fieldId).maybeSingle();
  if(!field)throw new Error("A földtábla nem található.");
  const{data:farm}=await supabase.from("farms").select("id,name,owner_id,country_code").eq("id",field.farm_id).maybeSingle();
  if(!farm)throw new Error("A gazdaság nem található.");
  if(role!=="advisor"&&farm.owner_id!==userId)throw new Error("Ehhez a földtáblához nincs jogosultságod.");
  return{field,farm};
}

async function validatePlantProtection(supabase:any,countryCode:"HU"|"SK",operationDate:string,formData:FormData,dose:number|null,doseUnit:string){
  const productId=text(formData.get("product_id"),100),useId=text(formData.get("use_id"),100);
  if(!productId)return null;
  const{data:product}=await supabase.from("plant_protection_products").select("id,name,country_code,authorization_number,active,valid_from,valid_until").eq("id",productId).maybeSingle();
  if(!product||!product.active)throw new Error("A kiválasztott növényvédő szer nem aktív vagy nem található.");
  if(product.country_code!==countryCode)throw new Error("A kiválasztott növényvédő szer nem engedélyezett a gazdaság országában.");
  if(product.valid_from&&product.valid_from>operationDate)throw new Error("A készítmény engedélye a művelet napján még nem volt hatályos.");
  if(product.valid_until&&product.valid_until<operationDate)throw new Error("A készítmény engedélye a művelet napján már nem volt hatályos.");
  let use:any=null;
  if(useId){
    const{data:row}=await supabase.from("plant_protection_uses").select("id,product_id,crop,target,dose_min,dose_max,dose_unit,application_method,phi_days").eq("id",useId).eq("product_id",productId).maybeSingle();
    if(!row)throw new Error("A kiválasztott növényvédelmi felhasználás nem tartozik ehhez a készítményhez.");
    use=row;
    if(dose!==null&&row.dose_unit&&doseUnit&&row.dose_unit!==doseUnit)throw new Error(`A kiválasztott felhasználáshoz ${row.dose_unit} dózisegység tartozik.`);
    if(dose!==null){if(row.dose_min!==null&&dose<Number(row.dose_min))throw new Error(`A dózis kisebb az engedélyezett minimumnál (${row.dose_min} ${row.dose_unit||""}).`);if(row.dose_max!==null&&dose>Number(row.dose_max))throw new Error(`A dózis nagyobb az engedélyezett maximumnál (${row.dose_max} ${row.dose_unit||""}).`)}
  }
  const{data:ingredients}=await supabase.from("plant_protection_ingredients").select("ingredient,concentration,concentration_unit").eq("product_id",productId).order("ingredient");
  const activeIngredient=(ingredients??[]).map((x:any)=>`${x.ingredient}${x.concentration==null?"":` ${x.concentration}${x.concentration_unit?` ${x.concentration_unit}`:""}`}`).join(", ");
  return{product,use,activeIngredient};
}

export async function createFieldOperation(formData:FormData){
  const{supabase,user,profile}=await context();
  const fieldId=text(formData.get("field_id"),100),date=text(formData.get("operation_date"),10),rawType=text(formData.get("operation_type"),40);
  if(!fieldId)throw new Error("Válassz földtáblát.");if(!validDate(date))throw new Error("Érvényes műveleti dátum szükséges.");
  const allowed=new Set(operationTypes.map(([k])=>k));if(!allowed.has(rawType as OperationType))throw new Error("Érvénytelen művelettípus.");
  const{field,farm}=await assertFieldAccess(supabase,user.id,profile?.role,fieldId),countryCode:"HU"|"SK"=farm.country_code==="SK"?"SK":"HU";
  const treatedArea=num(formData.get("treated_area")),dose=num(formData.get("dose")),quantity=num(formData.get("quantity"));
  if(treatedArea!==null&&(treatedArea<=0||treatedArea>Number(field.area_ha||999999)))throw new Error("A kezelt terület értéke hibás.");if(dose!==null&&dose<0)throw new Error("A dózis nem lehet negatív.");if(quantity!==null&&quantity<0)throw new Error("A mennyiség nem lehet negatív.");
  const type=rawType as OperationType,subtype=text(formData.get("subtype"),120);let product=text(formData.get("product"),180),activeIngredient=text(formData.get("active_ingredient"),300);
  const doseUnit=text(formData.get("dose_unit"),30),quantityUnit=text(formData.get("quantity_unit"),30),machine=text(formData.get("machine"),150),machineId=text(formData.get("machine_id"),100),weather=text(formData.get("weather"),180),notes=text(formData.get("notes"),1000),operator=text(formData.get("operator"),120);
  const spraying=type==="spraying"||type==="plant_protection",checked=spraying?await validatePlantProtection(supabase,countryCode,date,formData,dose,doseUnit):null;
  if(checked){product=checked.product.name;activeIngredient=checked.activeIngredient||activeIngredient}
  const crop=checked?.use?.crop||text(formData.get("crop"),160)||field.current_crop||undefined,target=checked?.use?.target||text(formData.get("target"),160)||undefined;
  const payload:OperationData={type,countryCode,subtype:subtype||undefined,product:product||undefined,productId:checked?.product.id||undefined,authorizationNumber:checked?.product.authorization_number||undefined,crop,target,useId:checked?.use?.id||undefined,activeIngredient:activeIngredient||undefined,dose,doseUnit:doseUnit||undefined,quantity,quantityUnit:quantityUnit||undefined,treatedArea,machine:machine||undefined,weather:weather||undefined,notes:notes||undefined,operator:operator||undefined};
  const catalogMode=checked?"official":(type==="fertilizing"||subtype?"catalog":"manual");
  const{data:operation,error:operationError}=await supabase.from("field_operations").insert({farm_id:field.farm_id,field_id:field.id,operation_date:date,operation_type:type,country_code:countryCode,subtype:subtype||null,product_id:checked?.product.id||null,plant_protection_use_id:checked?.use?.id||null,product_name:product||null,authorization_number:checked?.product.authorization_number||null,crop:crop||null,target:target||null,active_ingredient:activeIngredient||null,dose,dose_unit:doseUnit||null,quantity,quantity_unit:quantityUnit||null,treated_area:treatedArea,machine_id:machineId||null,machine_name:machine||null,operator_name:operator||null,weather:weather||null,notes:notes||null,catalog_mode:catalogMode,created_by:user.id}).select("id").single();
  if(operationError)throw new Error(operationError.message);
  const title=`Művelet: ${operationLabel(type)}${subtype?` – ${subtype}`:product?` – ${product}`:""}`,eventAt=new Date(`${date}T12:00:00`).toISOString();
  const{error:eventError}=await supabase.from("timeline_events").insert({farm_id:field.farm_id,field_id:field.id,event_type:OP_EVENT,title,description:encodeOperation(payload),event_at:eventAt,created_by:user.id,source_id:operation.id});
  if(eventError){await supabase.from("field_operations").delete().eq("id",operation.id);throw new Error(eventError.message)}
  revalidateOperationPaths(field.id);return{ok:true,id:operation.id};
}

export async function deleteFieldOperation(id:string){
  const{supabase,user,profile}=await context(),safe=text(id,100);if(!safe)throw new Error("Hiányzó művelet.");
  const{data:event}=await supabase.from("timeline_events").select("id,field_id,event_type,created_by,source_id").eq("id",safe).maybeSingle();if(!event||event.event_type!==OP_EVENT||!event.field_id)throw new Error("A művelet nem található.");
  await assertFieldAccess(supabase,user.id,profile?.role,event.field_id);if(profile?.role!=="advisor"&&event.created_by!==user.id)throw new Error("Csak a saját bejegyzésed törölheted.");
  const{error}=await supabase.from("timeline_events").delete().eq("id",safe).eq("event_type",OP_EVENT);if(error)throw new Error(error.message);
  if(event.source_id){const{error:opError}=await supabase.from("field_operations").delete().eq("id",event.source_id);if(opError)throw new Error(opError.message)}
  revalidateOperationPaths(event.field_id);return{ok:true};
}

function revalidateOperationPaths(fieldId:string){for(const p of ["/operations","/admin/operations","/timeline","/admin/timeline",`/fields/${fieldId}`,"/dashboard","/admin"])revalidatePath(p)}
