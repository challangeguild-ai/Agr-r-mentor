"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

export type ProfitActionState={ok:boolean;message:string;revision:number;navigateTo?:string};

class InputError extends Error{}
function fail(message:string):never{throw new InputError(message)}
const value=(form:FormData,name:string,max=240)=>String(form.get(name)??"").trim().slice(0,max);
const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

function amount(form:FormData,name:string,min:number,max:number){
 const raw=value(form,name,40).replace(/\s/g,"").replace(",",".");
 const n=Number(raw);
 if(!raw||!Number.isFinite(n)||n<min||n>max)fail(`A(z) ${name} mező értéke érvénytelen.`);
 return n;
}

function date(form:FormData,name:string){
 const raw=value(form,name,10);
 const valid=/^\d{4}-\d{2}-\d{2}$/.test(raw);
 const parsed=valid?new Date(`${raw}T12:00:00Z`):null;
 if(!parsed||Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==raw)fail("Érvényes dátum szükséges.");
 return raw;
}

async function context(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)fail("A mentéshez jelentkezz be.");
 const{data:profile,error}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
 if(error||!profile||profile.role!=="farmer"||profile.system_role==="admin")fail("A pénzügyi adatok csak a gazdaság tulajdonosának kezelhetők.");
 return{supabase,user};
}

async function ownedField(supabase:Awaited<ReturnType<typeof createClient>>,ownerId:string,fieldId:string){
 if(!uuid(fieldId))fail("Válassz egy érvényes földtáblát.");
 const{data:field,error}=await supabase.from("fields").select("id,farm_id,name,area_ha,current_crop,crop_year").eq("id",fieldId).maybeSingle();
 if(error||!field)fail("A földtábla nem érhető el.");
 const{data:farm}=await supabase.from("farms").select("id").eq("id",field.farm_id).eq("owner_id",ownerId).maybeSingle();
 if(!farm)fail("Csak a saját gazdaságod földtáblájának adatai rögzíthetők.");
 return field;
}

async function ownedSeason(supabase:Awaited<ReturnType<typeof createClient>>,ownerId:string,seasonId:string){
 if(!uuid(seasonId))fail("Érvénytelen termesztési év azonosító.");
 const{data:season,error}=await supabase.from("field_profit_seasons").select("id,farm_id,field_id,harvested_tonnes").eq("id",seasonId).maybeSingle();
 if(error||!season)fail("A kiválasztott pénzügyi év nem érhető el.");
 const{data:farm}=await supabase.from("farms").select("id").eq("id",season.farm_id).eq("owner_id",ownerId).maybeSingle();
 if(!farm)fail("A pénzügyi év nem tartozik a saját gazdaságodhoz.");
 return season;
}

async function safely(previous:ProfitActionState,work:()=>Promise<string|{message:string;navigateTo:string}>):Promise<ProfitActionState>{
 try{
  const result=await work();
  const message=typeof result==="string"?result:result.message;
  const navigateTo=typeof result==="string"?undefined:result.navigateTo;
  try{revalidatePath("/profit")}catch(error){
   console.error("Profitmodul – mentés sikerült, de a nézetfrissítés késhet",error);
   return{ok:true,message:`${message} A megjelenítés frissülése késhet.`,revision:previous.revision+1,navigateTo};
  }
  return{ok:true,message,revision:previous.revision+1,navigateTo};
 }
 catch(error){
  if(error instanceof InputError)return{ok:false,message:error.message,revision:previous.revision+1};
  console.error("Agrár Mentor profitmodul – mentés sikertelen",error);
  return{ok:false,message:"A mentés nem sikerült. Ellenőrizd a kapcsolatot és próbáld újra.",revision:previous.revision+1};
 }
}

export async function saveProfitSeason(previous:ProfitActionState,form:FormData):Promise<ProfitActionState>{
 return safely(previous,async()=>{
  const{supabase,user}=await context();
  const field=await ownedField(supabase,user.id,value(form,"field_id",50));
  const year=amount(form,"season_year",2000,2100);
  if(!Number.isInteger(year))fail("Az évszám egész szám legyen.");
  const crop=value(form,"crop_name",160);
  if(!crop)fail("Add meg a termesztett növényt.");
  const harvested=amount(form,"harvested_tonnes",0,10000000);
  const price=amount(form,"expected_price_huf_per_tonne",0,1000000000);
  if(Math.abs(Math.round(harvested*1000)-harvested*1000)>1e-6)fail("A termésmennyiséget legfeljebb három tizedessel add meg.");
  const{data:existing,error:lookupError}=await supabase.from("field_profit_seasons")
   .select("id,area_ha_snapshot").eq("field_id",field.id).eq("season_year",year).maybeSingle();
  if(lookupError)throw lookupError;
  if(existing){
   const{data:sales,error:salesError}=await supabase.from("field_profit_entries").select("quantity_tonnes").eq("season_id",existing.id).eq("entry_type","sale");
   if(salesError)throw salesError;
   const sold=(sales??[]).reduce((sum,s)=>sum+Number(s.quantity_tonnes||0),0);
   if(harvested+0.00001<sold)fail("A betakarított mennyiség nem lehet kevesebb a már eladott mennyiségnél.");
   const{error}=await supabase.from("field_profit_seasons").update({crop_name:crop,harvested_tonnes:harvested,expected_price_huf_per_tonne:price,updated_at:new Date().toISOString()}).eq("id",existing.id);
   if(error)throw error;
   return{message:"A termesztési év adatai frissültek.",navigateTo:`/profit?year=${year}&season=${existing.id}`};
  }
  const area=Number(field.area_ha||0);
  if(!Number.isFinite(area)||area<=0)fail("Előbb add meg a földtábla hektárban mért területét.");
  const newId=crypto.randomUUID();
  const{error}=await supabase.from("field_profit_seasons").insert({id:newId,farm_id:field.farm_id,field_id:field.id,season_year:year,crop_name:crop,area_ha_snapshot:area,harvested_tonnes:harvested,expected_price_huf_per_tonne:price,created_by:user.id});
  if(error)throw error;
  return{message:"A termesztési év létrejött. Most már rögzítheted a költségeket és az eladásokat.",navigateTo:`/profit?year=${year}&season=${newId}`};
 });
}

export async function addProfitCost(previous:ProfitActionState,form:FormData):Promise<ProfitActionState>{
 return safely(previous,async()=>{
  const{supabase,user}=await context();
  const season=await ownedSeason(supabase,user.id,value(form,"season_id",50));
  const category=value(form,"category",80),description=value(form,"description",240);
  if(!category)fail("Válassz költségkategóriát.");
  const sum=amount(form,"amount_huf",1,1000000000000);
  const{error}=await supabase.from("field_profit_entries").insert({season_id:season.id,entry_type:"cost",category,description,occurred_on:date(form,"occurred_on"),amount_huf:sum,created_by:user.id});
  if(error)throw error;
  return"A költségtételt elmentettük.";
 });
}

export async function addProfitSale(previous:ProfitActionState,form:FormData):Promise<ProfitActionState>{
 return safely(previous,async()=>{
  const{supabase,user}=await context();
  const season=await ownedSeason(supabase,user.id,value(form,"season_id",50));
  const quantity=amount(form,"quantity_tonnes",0.001,10000000),price=amount(form,"price_huf_per_tonne",0,1000000000);
  if(Math.abs(Math.round(quantity*1000)-quantity*1000)>1e-6)fail("A mennyiséget legfeljebb három tizedessel add meg.");
  const{data:sales,error:salesError}=await supabase.from("field_profit_entries").select("quantity_tonnes").eq("season_id",season.id).eq("entry_type","sale");
  if(salesError)throw salesError;
  const sold=(sales??[]).reduce((sum,s)=>sum+Number(s.quantity_tonnes||0),0);
  if(sold+quantity>Number(season.harvested_tonnes)+0.00001)fail("Nem értékesíthetsz többet a nyilvántartott betakarított mennyiségnél.");
  const{error}=await supabase.from("field_profit_entries").insert({season_id:season.id,entry_type:"sale",category:"Terményértékesítés",description:value(form,"description",240),occurred_on:date(form,"occurred_on"),quantity_tonnes:quantity,price_huf_per_tonne:price,created_by:user.id});
  if(error)throw error;
  return"Az értékesítést rögzítettük.";
 });
}

export async function deleteProfitEntry(previous:ProfitActionState,form:FormData):Promise<ProfitActionState>{
 return safely(previous,async()=>{
  const{supabase,user}=await context();
  const entryId=value(form,"entry_id",50);
  if(!uuid(entryId))fail("Érvénytelen bejegyzésazonosító.");
  const{data:entry,error:entryError}=await supabase.from("field_profit_entries").select("id,season_id").eq("id",entryId).maybeSingle();
  if(entryError||!entry)fail("A tétel nem található.");
  await ownedSeason(supabase,user.id,entry.season_id);
  const{error}=await supabase.from("field_profit_entries").delete().eq("id",entryId);
  if(error)throw error;
  return"A tételt töröltük.";
 });
}
