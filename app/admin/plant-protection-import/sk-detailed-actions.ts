"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

type Row=Record<string,string>;
export type SkDetailedImportResult={ok:boolean;error?:string;rows?:number;inserted_products?:number;inserted_uses?:number;updated_uses?:number;inserted_ingredients?:number};

const aliases:Record<string,string>={
  "obchodny nazov pripravku":"name","nazov pripravku":"name","pripravok":"name",
  "cislo autorizacie":"authorization_number","cislo povolenia":"authorization_number",
  "typ funkcie pripravku":"function_type","funkcia pripravku":"function_type",
  "plodina":"crop","plodina alebo oblast pouzitia":"crop","oblast pouzitia":"crop",
  "skodlivy organizmus alebo iny ucel pouzitia":"target","skodlivy organizmus":"target","ucel pouzitia":"target",
  "davka":"dose_max","davka pripravku":"dose_max","maximalna davka":"dose_max","minimalna davka":"dose_min",
  "jednotka davky":"dose_unit","merna jednotka davky":"dose_unit",
  "sposob aplikacie":"application_method","metoda aplikacie":"application_method",
  "ochranna doba":"phi_days","ochranna lehota":"phi_days","phi":"phi_days",
  "bbch od":"bbch_min","bbch min":"bbch_min","rastova faza od":"bbch_min","stadium rastu od":"bbch_min",
  "bbch do":"bbch_max","bbch max":"bbch_max","rastova faza do":"bbch_max","stadium rastu do":"bbch_max",
  "maximalny pocet aplikacii":"max_applications","max pocet aplikacii":"max_applications","pocet aplikacii":"max_applications",
  "interval medzi aplikaciami":"application_interval_days","interval aplikacie":"application_interval_days",
  "mnozstvo vody od":"water_volume_min","objem vody od":"water_volume_min","minimalne mnozstvo vody":"water_volume_min",
  "mnozstvo vody do":"water_volume_max","objem vody do":"water_volume_max","maximalne mnozstvo vody":"water_volume_max",
  "termin aplikacie":"application_timing","cas aplikacie":"application_timing","poznamka k aplikacii":"application_timing",
  "obmedzenia":"restrictions","obmedzenie":"restrictions","osobitne podmienky":"restrictions","podmienky pouzitia":"restrictions",
  "zdroj":"source_reference","referencia":"source_reference","cislo rozhodnutia":"source_reference",
  "ucinna latka":"ingredient","nazov ucinnej latky":"ingredient","chemicka latka":"ingredient"
};

function norm(value:string){return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[._-]+/g," ").replace(/\s+/g," ")}
function normalizeNewlines(value:string){return value.replace(/\r\n/g,"\n").replace(/\r/g,"\n")}
function headerKey(value:string){const n=norm(value).replace(/^\d+[a-z]?\s*/,"");return aliases[n]||n.replace(/\s+/g,"_")}

function parseDelimited(input:string){
  let text=normalizeNewlines(input.replace(/^\uFEFF/,"")).trim();
  if(!text)return[] as Row[];
  const first=text.split("\n")[0]||"";
  const candidates:string[]=[";","\t",","];
  const sep=candidates.sort((a,b)=>(first.split(b).length)-(first.split(a).length))[0]||";";
  const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;continue}
    if(ch==='"'){quoted=!quoted;continue}
    if(ch===sep&&!quoted){row.push(cell.trim());cell="";continue}
    if(ch==='\n'&&!quoted){row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell="";continue}
    cell+=ch;
  }
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  if(rows.length<2)return[];
  const header=rows[0].map(headerKey);
  return rows.slice(1).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]||""]))).filter(r=>r.name&&r.crop);
}

function normalizeNumeric(row:Row,key:string){
  const raw=(row[key]||"").trim();if(!raw)return;
  const match=raw.replace(/,/g,".").match(/-?\d+(?:\.\d+)?/);
  if(match)row[key]=match[0];
}

function normalizeRows(rows:Row[]){
  return rows.map(original=>{
    const row={...original};
    for(const k of ["dose_min","dose_max","phi_days","bbch_min","bbch_max","max_applications","application_interval_days","water_volume_min","water_volume_max"])normalizeNumeric(row,k);
    if(!row.dose_min&&row.dose_max)row.dose_min=row.dose_max;
    if(!row.source_reference)row.source_reference="ÚKSÚP ISPOR részletes felhasználási adat";
    return row;
  });
}

async function advisorContext(){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="advisor")throw new Error("Csak szaktanácsadó/admin indíthat ÚKSÚP részletes importot.");
  return{supabase,user};
}

export async function importUksupDetailedUsesCsv(formData:FormData):Promise<SkDetailedImportResult>{
  try{
    const raw=String(formData.get("sk_detailed_csv")||"");
    const sourceUrl=String(formData.get("sk_detailed_source_url")||"").trim();
    const parsed=normalizeRows(parseDelimited(raw));
    if(!parsed.length)throw new Error("Nem találtam részletes szlovák felhasználási rekordot. A fájlban legalább készítmény- és kultúraoszlop szükséges.");
    const{supabase}=await advisorContext();
    const totals={rows:0,inserted_products:0,inserted_uses:0,updated_uses:0,inserted_ingredients:0};
    for(let i=0;i<parsed.length;i+=500){
      const chunk=parsed.slice(i,i+500);
      const{data,error}=await supabase.rpc("import_plant_protection_catalog",{
        p_country_code:"SK",
        p_source_name:"ÚKSÚP ISPOR – részletes felhasználások",
        p_source_url:sourceUrl,
        p_rows:chunk,
        p_notes:`Részletes ÚKSÚP felhasználási import; ${parsed.length} feldolgozott sor.`
      });
      if(error)throw new Error(error.message);
      const d:any=data||{};
      totals.rows+=Number(d.rows||chunk.length);
      totals.inserted_products+=Number(d.inserted_products||0);
      totals.inserted_uses+=Number(d.inserted_uses||0);
      totals.updated_uses+=Number(d.updated_uses||0);
      totals.inserted_ingredients+=Number(d.inserted_ingredients||0);
    }
    revalidatePath("/admin/plant-protection-import");
    revalidatePath("/operations");
    return{ok:true,...totals};
  }catch(error){
    return{ok:false,error:error instanceof Error?error.message:"Az ÚKSÚP részletes import ismeretlen hiba miatt megszakadt."};
  }
}
