import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {calculateProfit} from "@/lib/profitMath";

export class FinanceDenied extends Error{}
type Entry={id:string;entry_type:"cost"|"sale";category:string;description:string;occurred_on:string;amount_huf:number|null;quantity_tonnes:number|null;price_huf_per_tonne:number|null};
type Season={id:string;fieldName:string;cropName:string;year:number;harvestedTonnes:number;areaHa:number;entries:Entry[];totals:ReturnType<typeof calculateProfit>};
export type AdvisorFinanceFarm={id:string;name:string;seasons:Season[]};

/** Only audited server code may read financial records for assigned advisors. Direct PostgREST stays farmer-only. */
export async function readAdvisorFinance(userId:string,requestedFarm?:string):Promise<AdvisorFinanceFarm[]>{
 const db=createAdminClient();
 const{data:profile,error:profileError}=await db.from("profiles").select("role,system_role").eq("id",userId).maybeSingle();
 if(profileError||profile?.role!=="advisor"||(profile.system_role??"user")!=="user")throw new FinanceDenied("Nincs szaktanácsadói pénzügyi jogosultság.");
 const{data:grants,error:grantError}=await db.from("farm_advisor_finance_grants").select("farm_id,owner_id").eq("advisor_id",userId).is("revoked_at",null);
 if(grantError)throw new Error("A pénzügyi jogosultság ellenőrzése sikertelen.");
 const grantOwners=new Map((grants??[]).map(g=>[g.farm_id,g.owner_id]));
 if(requestedFarm&&!grantOwners.has(requestedFarm))throw new FinanceDenied("A gazdasághoz nincs pénzügyi hozzáférés.");
 const farmIds=requestedFarm?[requestedFarm]:[...grantOwners.keys()];
 if(!farmIds.length)return [];
 const{data:rawFarms,error:farmError}=await db.from("farms").select("id,name,owner_id").in("id",farmIds).order("name");
 if(farmError)throw new Error("A gazdaságok nem tölthetők be.");
 // A grant never follows a farm to its next owner.
 const farms=(rawFarms??[]).filter(f=>grantOwners.get(f.id)===f.owner_id);
 if(requestedFarm&&!farms.some(f=>f.id===requestedFarm))throw new FinanceDenied("A korábbi jogosultság tulajdonosváltás miatt már nem érvényes.");
 if(!farms.length)return [];
 const owners=new Map(farms.map(f=>[f.id,f.owner_id]));
 const{data:rawSeasons,error:seasonError}=await db.from("field_profit_seasons").select("id,farm_id,field_id,created_by,season_year,crop_name,area_ha_snapshot,harvested_tonnes,expected_price_huf_per_tonne").in("farm_id",farms.map(f=>f.id)).order("season_year",{ascending:false});
 if(seasonError)throw new Error("A pénzügyi évek nem olvashatók.");
 const seasons=(rawSeasons??[]).filter(s=>owners.get(s.farm_id)===s.created_by);
 const fieldIds=[...new Set(seasons.map(s=>s.field_id))];
 const seasonIds=seasons.map(s=>s.id);
 const [{data:fields,error:fieldError},{data:rows,error:entryError}]=await Promise.all([
  fieldIds.length?db.from("fields").select("id,name").in("id",fieldIds):Promise.resolve({data:[],error:null}),
  seasonIds.length?db.from("field_profit_entries").select("id,season_id,created_by,entry_type,category,description,occurred_on,amount_huf,quantity_tonnes,price_huf_per_tonne").in("season_id",seasonIds):Promise.resolve({data:[],error:null})
 ]);
 if(fieldError||entryError)throw new Error("A pénzügyi tételek nem tölthetők be.");
 const names=new Map((fields??[]).map(f=>[f.id,f.name]));
 const seasonOwners=new Map(seasons.map(s=>[s.id,s.created_by]));
 const entries=new Map<string,Entry[]>();
 for(const r of rows??[]){
  if(seasonOwners.get(r.season_id)!==r.created_by)continue;
  const entry:Entry={id:r.id,entry_type:r.entry_type as "cost"|"sale",category:r.category,description:r.description??"",occurred_on:r.occurred_on,amount_huf:r.amount_huf===null?null:Number(r.amount_huf),quantity_tonnes:r.quantity_tonnes===null?null:Number(r.quantity_tonnes),price_huf_per_tonne:r.price_huf_per_tonne===null?null:Number(r.price_huf_per_tonne)};
  entries.set(r.season_id,[...(entries.get(r.season_id)??[]),entry]);
 }
 const result=farms.map(f=>({id:f.id,name:f.name,seasons:seasons.filter(s=>s.farm_id===f.id).map(s=>{
  const items=entries.get(s.id)??[],harvested=Number(s.harvested_tonnes),area=Number(s.area_ha_snapshot);
  return{id:s.id,fieldName:names.get(s.field_id)??"Földtábla",cropName:s.crop_name,year:s.season_year,harvestedTonnes:harvested,areaHa:area,entries:items,totals:calculateProfit({harvestedTonnes:harvested,expectedPriceHufPerTonne:Number(s.expected_price_huf_per_tonne),areaHa:area,entries:items})};
 })}));
 const{error:auditError}=await db.from("admin_audit_events").insert({actor_user_id:userId,action:"advisor_finance_view",target_type:"farm_finance",target_id:requestedFarm??"authorized_portfolio",reason:"Engedélyezett szaktanácsadói pénzügyi betekintés",metadata:{farm_ids:result.map(f=>f.id),season_count:seasons.length}});
 if(auditError)throw new Error("A betekintést nem sikerült naplózni; a rendszer nem adhatja ki az adatokat.");
 return result;
}
