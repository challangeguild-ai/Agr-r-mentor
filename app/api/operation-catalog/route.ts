import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

const countries=new Set(["HU","SK"]);
const operationTypes=new Set(["spraying","plant_protection","fertilizing","sowing","soil_work","harvest","irrigation","mowing","other"]);
const PAGE=1000,ID_CHUNK=100;
function chunks<T>(items:T[],size:number){const out:T[][]=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out}
function regulatoryDisplay(p:any,country:string){
 if(country!=="HU")return p;
 const original=p.authorization_number||"";
 if(p.regulatory_status==="not_applicable")return{...p,authorization_number:`⛔ NEM ALKALMAZHATÓ${p.grace_period_until?` · türelmi idő vége: ${p.grace_period_until}`:""}${original?` · ${original}`:""}`};
 if(p.regulatory_status==="withdrawn_grace")return{...p,authorization_number:`⚠ VISSZAVONT${p.grace_period_until?` · felhasználható legfeljebb: ${p.grace_period_until}`:" · türelmi idő ellenőrzendő"}${original?` · ${original}`:""}`};
 if(p.regulatory_status==="unknown")return{...p,authorization_number:`⚠ STÁTUSZ ELLENŐRIZENDŐ${original?` · ${original}`:""}`};
 return p;
}
function preferCountryCatalog(items:any[],country:string){const byKey=new Map<string,any>();for(const item of items){const key=`${item.operation_type}::${String(item.name||"").trim().toLocaleLowerCase("hu-HU")}`;const current=byKey.get(key);if(!current||item.country_code===country||(current.country_code!=="HU"&&current.country_code!=="SK"))byKey.set(key,item)}return[...byKey.values()].sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.name).localeCompare(String(b.name),"hu"))}
function noStore(body:any,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store, max-age=0"}})}

export async function GET(request:NextRequest){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)return noStore({error:"Nincs bejelentkezve."},401);
  const country=request.nextUrl.searchParams.get("country")||"HU";
  const type=request.nextUrl.searchParams.get("type")||"spraying";
  const farmId=request.nextUrl.searchParams.get("farm")||"";
  if(!countries.has(country)||!operationTypes.has(type))return noStore({error:"Érvénytelen katalóguskérés."},400);
  if(farmId){const{data:farm,error:farmError}=await supabase.from("farms").select("id,owner_id,country_code").eq("id",farmId).maybeSingle();if(farmError)return noStore({error:farmError.message},500);if(!farm||farm.owner_id!==user.id)return noStore({error:"Ehhez a gazdasághoz nincs hozzáférésed."},403);if(farm.country_code!==country)return noStore({error:"A gazdaság országa nem egyezik a kért katalógussal."},400)}
  const[{data:catalog,error:catalogError},{data:source,error:sourceError}]=await Promise.all([
    supabase.from("operation_catalog").select("id,country_code,operation_type,category,name,metadata,sort_order").in("country_code",[country,"ALL"]).eq("operation_type",type).eq("active",true).order("sort_order").order("name"),
    supabase.from("operation_catalog_sources").select("country_code,source_name,source_url,last_checked_at,last_imported_at,product_count,use_count,status,notes").eq("country_code",country).maybeSingle(),
  ]);
  if(catalogError)return noStore({error:catalogError.message},500);if(sourceError)return noStore({error:sourceError.message},500);const effectiveCatalog=preferCountryCatalog(catalog??[],country);
  let approvers:any[]=[];
  if(farmId){const today=new Date().toISOString().slice(0,10);const{data:authorizations,error:authError}=await supabase.from("farm_plant_protection_approvers").select("user_id,authorization_level,permit_number,valid_until,active").eq("farm_id",farmId).eq("active",true).or(`valid_until.is.null,valid_until.gte.${today}`);if(authError)return noStore({error:authError.message},500);const ids=(authorizations??[]).map(x=>x.user_id);if(ids.length){const{data:profiles,error:profileError}=await supabase.from("profiles").select("id,full_name,role").in("id",ids);if(profileError)return noStore({error:profileError.message},500);const profileMap=new Map((profiles??[]).map(p=>[p.id,p]));approvers=(authorizations??[]).map(a=>({id:a.user_id,full_name:profileMap.get(a.user_id)?.full_name||"Gazdasági jogosult",role:profileMap.get(a.user_id)?.role||null,authorization_level:a.authorization_level,permit_number:a.permit_number,valid_until:a.valid_until})).filter(a=>a.role!=="advisor")}}
  if(type!=="spraying"&&type!=="plant_protection")return noStore({country,type,catalog:effectiveCatalog,products:[],uses:[],approvers,source});
  const products:any[]=[];
  for(let from=0;;from+=PAGE){const{data,error}=await supabase.from("plant_protection_products").select("id,name,authorization_number,function_type,valid_from,valid_until,source_name,source_checked_at,source_url,source_snapshot_at,regulatory_category,regulatory_status,withdrawal_effective_at,grace_period_until,status_note,professional_use_only,prescription_required,approval_required,active").eq("country_code",country).eq("active",true).order("name").range(from,from+PAGE-1);if(error)return noStore({error:error.message},500);products.push(...(data??[]));if((data??[]).length<PAGE)break}
  const productIds=products.map(p=>p.id);if(!productIds.length)return noStore({country,type,catalog:effectiveCatalog,products:[],uses:[],ingredients:[],approvers,source});
  const uses:any[]=[],ingredients:any[]=[];
  for(const ids of chunks(productIds,ID_CHUNK)){for(let from=0;;from+=PAGE){const{data,error}=await supabase.from("plant_protection_uses").select("id,product_id,crop,target,dose_min,dose_max,dose_unit,application_method,phi_days,notes,bbch_min,bbch_max,max_applications,application_interval_days,water_volume_min,water_volume_max,water_volume_unit,application_timing,restrictions,source_reference").in("product_id",ids).order("crop").range(from,from+PAGE-1);if(error)return noStore({error:error.message},500);uses.push(...(data??[]));if((data??[]).length<PAGE)break}for(let from=0;;from+=PAGE){const{data,error}=await supabase.from("plant_protection_ingredients").select("product_id,ingredient,concentration,concentration_unit").in("product_id",ids).order("ingredient").range(from,from+PAGE-1);if(error)return noStore({error:error.message},500);ingredients.push(...(data??[]));if((data??[]).length<PAGE)break}}
  const quality={products:products.length,uses:uses.length,with_target:uses.filter(u=>u.target).length,with_dose:uses.filter(u=>u.dose_min!=null||u.dose_max!=null).length,with_bbch:uses.filter(u=>u.bbch_min!=null||u.bbch_max!=null).length};
  return noStore({country,type,catalog:effectiveCatalog,products:products.map(p=>regulatoryDisplay(p,country)),uses,ingredients,approvers,source,quality});
}
