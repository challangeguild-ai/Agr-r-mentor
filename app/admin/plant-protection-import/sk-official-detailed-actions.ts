"use server";

import * as XLSX from "xlsx";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

type Row=Record<string,string>;
export type SkOfficialDetailedSyncResult={ok:boolean;error?:string;rows?:number;inserted_products?:number;inserted_uses?:number;updated_uses?:number;inserted_ingredients?:number;source_url?:string;sheets?:number;products?:number;crops?:number;with_dose?:number;with_target?:number};

const aliases:Record<string,string>={
 "obchodny nazov pripravku":"name","nazov pripravku":"name","pripravok":"name","nazov por":"name",
 "cislo autorizacie":"authorization_number","cislo povolenia":"authorization_number","autorizacne cislo":"authorization_number",
 "typ funkcie pripravku":"function_type","funkcia pripravku":"function_type","funkcia":"function_type",
 "plodina":"crop","plodina alebo oblast pouzitia":"crop","oblast pouzitia":"crop","pouzitie":"crop",
 "skodlivy organizmus alebo iny ucel pouzitia":"target","skodlivy organizmus":"target","ucel pouzitia":"target","skodca":"target",
 "davka":"dose_raw","davka pripravku":"dose_raw","maximalna davka":"dose_raw","minimalna davka":"dose_min",
 "jednotka davky":"dose_unit","merna jednotka davky":"dose_unit",
 "sposob aplikacie":"application_method","metoda aplikacie":"application_method","metoda pouzitia":"application_method",
 "ochranna doba":"phi_raw","ochranna lehota":"phi_raw","phi":"phi_raw",
 "bbch od":"bbch_min","bbch min":"bbch_min","rastova faza od":"bbch_min","stadium rastu od":"bbch_min",
 "bbch do":"bbch_max","bbch max":"bbch_max","rastova faza do":"bbch_max","stadium rastu do":"bbch_max",
 "rastova faza":"bbch_range","rastove stadium":"bbch_range","bbch":"bbch_range",
 "maximalny pocet aplikacii":"max_applications","max pocet aplikacii":"max_applications","pocet aplikacii":"max_applications",
 "interval medzi aplikaciami":"application_interval_days","interval aplikacie":"application_interval_days","interval":"application_interval_days",
 "mnozstvo vody":"water_raw","objem vody":"water_raw","mnozstvo vody od":"water_volume_min","objem vody od":"water_volume_min","minimalne mnozstvo vody":"water_volume_min",
 "mnozstvo vody do":"water_volume_max","objem vody do":"water_volume_max","maximalne mnozstvo vody":"water_volume_max",
 "termin aplikacie":"application_timing","cas aplikacie":"application_timing","poznamka k aplikacii":"application_timing",
 "obmedzenia":"restrictions","obmedzenie":"restrictions","osobitne podmienky":"restrictions","podmienky pouzitia":"restrictions","poznamka":"restrictions",
 "ucinna latka":"ingredient","nazov ucinnej latky":"ingredient","chemicka latka":"ingredient"
};

const LIST_PAGES=["https://www.uksup.sk/orp-zoznamy-pripravkov-na-ochranu-rastlin","https://beta.uksup.sk/orp-zoznamy-pripravkov-na-ochranu-rastlin"];
function norm(value:string){return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/&nbsp;|\u00a0/g," ").replace(/[._–—-]+/g," ").replace(/\s+/g," ")}
function stripHtml(value:string){return value.replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim()}
function headerKey(value:string){const n=norm(value).replace(/^\d+[a-z]?\s*/,"");return aliases[n]||n.replace(/\s+/g,"_")}
function numbers(value:string){return (value.replace(/,/g,".").match(/\d+(?:\.\d+)?/g)||[]).map(Number).filter(Number.isFinite)}
function measureUnit(value:string){return value.match(/(?:ml|l|kg|g)\s*\/\s*(?:ha|100\s*l)|(?:ml|l|kg|g)\b/i)?.[0]?.replace(/\s+/g,"")||""}
function appendText(a:string,b:string){return [a,b].filter(Boolean).join(" · ")}

function normalizeRow(original:Row){
 const row={...original};
 const dose=String(row.dose_raw||"");if(dose){const n=numbers(dose);if(n.length){row.dose_min=String(n.length>1?Math.min(...n):n[0]);row.dose_max=String(n.length>1?Math.max(...n):n[0])}if(!row.dose_unit)row.dose_unit=measureUnit(dose)}
 const water=String(row.water_raw||"");if(water){const n=numbers(water);if(n.length){row.water_volume_min=String(n.length>1?Math.min(...n):n[0]);row.water_volume_max=String(n.length>1?Math.max(...n):n[0])}row.water_volume_unit=measureUnit(water)||"l/ha"}
 const bbch=String(row.bbch_range||"");if(bbch){const n=numbers(bbch).map(Math.trunc).filter(x=>x>=0&&x<=99);if(n.length){row.bbch_min=String(Math.min(...n));row.bbch_max=String(Math.max(...n))}}
 const phi=String(row.phi_raw||"").trim();if(phi){const n=numbers(phi);if(n.length)row.phi_days=String(Math.trunc(n[0]));else row.restrictions=appendText(row.restrictions||"",`Ochranná doba: ${phi}`)}
 for(const k of ["bbch_min","bbch_max","max_applications","application_interval_days"]){const n=numbers(String(row[k]||""));row[k]=n.length?String(Math.trunc(n[0])):""}
 for(const k of ["dose_min","dose_max","water_volume_min","water_volume_max"]){const n=numbers(String(row[k]||""));row[k]=n.length?String(n[0]):""}
 if(row.bbch_min&&Number(row.bbch_min)>99)row.bbch_min="";if(row.bbch_max&&Number(row.bbch_max)>99)row.bbch_max="";
 row.source_reference=row.source_reference||"ÚKSÚP – rozsah použitia (hivatalos XLSX)";return row;
}

function sheetRows(sheet:XLSX.WorkSheet){
 const matrix=XLSX.utils.sheet_to_json<(string|number|null)[]>(sheet,{header:1,raw:false,defval:""}) as unknown as (string|number|null)[][];
 let headerIndex=-1,header:string[]=[];for(let i=0;i<Math.min(matrix.length,60);i++){const keys=(matrix[i]||[]).map(v=>headerKey(String(v??"")));if(keys.includes("name")&&keys.includes("crop")){headerIndex=i;header=keys;break}}
 if(headerIndex<0)return[] as Row[];const out:Row[]=[];let carry:Row={};
 for(const cells of matrix.slice(headerIndex+1)){const row:Row={};header.forEach((h,i)=>{if(h)row[h]=String(cells?.[i]??"").trim()});for(const key of ["name","authorization_number","function_type","ingredient"]){if(row[key])carry[key]=row[key];else if(carry[key])row[key]=carry[key]}if(!row.name||!row.crop)continue;const n=normalizeRow(row);if(n.name&&n.crop)out.push(n)}return out;
}
function workbookRows(buffer:ArrayBuffer){
 const wb=XLSX.read(buffer,{type:"array",cellDates:false});const rows:Row[]=[];for(const name of wb.SheetNames){const sheet=wb.Sheets[name];if(sheet)rows.push(...sheetRows(sheet))}
 const dedup=new Map<string,Row>();for(const row of rows){const key=[row.name,row.authorization_number,row.crop,row.target,row.dose_max,row.dose_unit,row.application_method,row.bbch_min,row.bbch_max].map(v=>norm(v||"")).join("|");if(!dedup.has(key))dedup.set(key,row)}
 const unique=[...dedup.values()],products=new Set(unique.map(r=>norm(r.name))).size,crops=new Set(unique.map(r=>norm(r.crop))).size,withDose=unique.filter(r=>r.dose_max||r.dose_min).length,withTarget=unique.filter(r=>r.target).length;
 if(unique.length<100||products<20||crops<5)throw new Error(`A részletes XLSX szerkezete gyanús: ${unique.length} felhasználás, ${products} készítmény, ${crops} kultúra. Import megszakítva.`);
 return{rows:unique,sheets:wb.SheetNames.length,products,crops,withDose,withTarget};
}
async function fetchText(url:string,timeout=15000){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:"no-store",signal:c.signal,headers:{"user-agent":"Agrar-Mentor/1.0 UKSUP detailed sync","accept":"text/html,*/*"}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(t)}}
async function fetchBinary(url:string,timeout=30000){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:"no-store",signal:c.signal,headers:{"user-agent":"Agrar-Mentor/1.0 UKSUP detailed sync","accept":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*"}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const b=await r.arrayBuffer();if(b.byteLength<10000)throw new Error("A letöltött XLSX túl kicsi.");if(b.byteLength>30*1024*1024)throw new Error("A letöltött XLSX szokatlanul nagy; biztonsági okból nem dolgozom fel.");const sig=new Uint8Array(b.slice(0,4));if(!(sig[0]===0x50&&sig[1]===0x4b))throw new Error("A letöltött állomány nem XLSX/ZIP formátumú.");return b}finally{clearTimeout(t)}}

async function discoverWorkbook(){const problems:string[]=[];for(const page of LIST_PAGES){try{const html=await fetchText(page);const anchors=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];const candidates=anchors.map(m=>({href:m[1],text:stripHtml(m[2])})).map(x=>({...x,score:(norm(x.text).includes("rozsahom ich pouzitia")?100:0)+(norm(x.text).includes("autorizovanych a povolenych")?60:0)+(x.href.toLowerCase().includes("xlsx")?20:0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);for(const c of candidates){try{const url=new URL(c.href,page).toString();const buffer=await fetchBinary(url);const parsed=workbookRows(buffer);return{url,...parsed}}catch(e){problems.push(`${new URL(page).host}: ${e instanceof Error?e.message:"XLSX hiba"}`)}}problems.push(`${new URL(page).host}: nem találtam megfelelő részletes XLSX hivatkozást`)}catch(e){problems.push(`${new URL(page).host}: ${e instanceof Error?e.message:"oldalhiba"}`)}}throw new Error(`A hivatalos ÚKSÚP részletes XLSX automatikus letöltése nem sikerült. ${problems.slice(-6).join("; ")}`)}
async function advisorContext(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(profile?.role!=="advisor")throw new Error("Csak szaktanácsadó/admin indíthat ÚKSÚP részletes szinkront.");return{supabase,user}}

export async function syncUksupOfficialDetailedUses():Promise<SkOfficialDetailedSyncResult>{try{const{supabase}=await advisorContext();const{url,rows,sheets,products,crops,withDose,withTarget}=await discoverWorkbook();const totals={rows:0,inserted_products:0,inserted_uses:0,updated_uses:0,inserted_ingredients:0};for(let i=0;i<rows.length;i+=400){const chunk=rows.slice(i,i+400);const{data,error}=await supabase.rpc("import_plant_protection_catalog",{p_country_code:"SK",p_source_name:"ÚKSÚP – hivatalos részletes felhasználási XLSX",p_source_url:url,p_rows:chunk,p_notes:`Automatikus részletes ÚKSÚP XLSX szinkron; ${rows.length} rekord, ${sheets} munkalap, ${products} készítmény, ${crops} kultúra.`});if(error)throw new Error(error.message);const d:any=data||{};totals.rows+=Number(d.rows||chunk.length);totals.inserted_products+=Number(d.inserted_products||0);totals.inserted_uses+=Number(d.inserted_uses||0);totals.updated_uses+=Number(d.updated_uses||0);totals.inserted_ingredients+=Number(d.inserted_ingredients||0)}revalidatePath("/admin/plant-protection-import");revalidatePath("/operations");return{ok:true,...totals,source_url:url,sheets,products,crops,with_dose:withDose,with_target:withTarget}}catch(e){return{ok:false,error:e instanceof Error?e.message:"Az ÚKSÚP részletes automatikus szinkron ismeretlen hiba miatt megszakadt."}}}
