"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

type Row=Record<string,string>;
const aliases:Record<string,string>={
 "növényvédő szer neve":"name","novenyvedo szer neve":"name","novenyvedo_szer_neve":"name","készítmény":"name","keszitmeny":"name","obchodný názov prípravku":"name","obchodny nazov pripravku":"name","obchodny_nazov_pripravku":"name",
 "engedély száma":"authorization_number","engedely szama":"authorization_number","engedelyszam":"authorization_number","číslo autorizácie":"authorization_number","cislo autorizacie":"authorization_number","cislo_autorizacie":"authorization_number",
 "forgalmazási kategória":"regulatory_category","forgalmazasi kategoria":"regulatory_category","forg kategória":"regulatory_category","forg kategoria":"regulatory_category","kategória":"regulatory_category","kategoria":"regulatory_category",
 "rendeltetés":"function_type","rendeltetes":"function_type","typ funkcie prípravku":"function_type","typ funkcie pripravku":"function_type",
 "kultúra":"crop","kultura":"crop","plodina":"crop","plodina alebo oblasť použitia":"crop","plodina alebo oblast pouzitia":"crop",
 "károsító":"target","karosito":"target","cél":"target","cel":"target","škodlivý organizmus alebo iný účel použitia":"target","skodlivy organizmus alebo iny ucel pouzitia":"target",
 "dózis min":"dose_min","dozis min":"dose_min","min dózis":"dose_min","min dozis":"dose_min","dose_min":"dose_min",
 "dózis max":"dose_max","dozis max":"dose_max","max dózis":"dose_max","max dozis":"dose_max","dose_max":"dose_max",
 "dózis egység":"dose_unit","dozis egyseg":"dose_unit","jednotka dávky":"dose_unit","jednotka davky":"dose_unit",
 "kijuttatás módja":"application_method","kijuttatas modja":"application_method","spôsob aplikácie":"application_method","sposob aplikacie":"application_method",
 "évi":"phi_days","evi":"phi_days","várakozási idő":"phi_days","varakozasi ido":"phi_days","phi_days":"phi_days",
 "hatóanyag":"ingredient","hatoanyag":"ingredient","hatóanyag összetétel":"ingredient","hatoanyag osszetetel":"ingredient","názov účinnej látky":"ingredient","nazov ucinnej latky":"ingredient"
};
function norm(s:string){return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[._-]+/g," ").replace(/\s+/g," ")}
function parseCsv(input:string){const text=input.replace(/^\uFEFF/,"").trim();if(!text)return[] as Row[];const sep=(text.split("\n")[0].match(/;/g)?.length||0)>=(text.split("\n")[0].match(/,/g)?.length||0)?";":",";const rows:string[][]=[];let row:string[]=[],cell="",q=false;for(let i=0;i<text.length;i++){const ch=text[i],n=text[i+1];if(ch==='"'&&q&&n==='"'){cell+='"';i++;continue}if(ch==='"'){q=!q;continue}if(ch===sep&&!q){row.push(cell.trim());cell="";continue}if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&n==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell="";continue}cell+=ch}row.push(cell.trim());if(row.some(Boolean))rows.push(row);if(rows.length<2)return[];const header=rows[0].map(h=>aliases[norm(h)]||h.trim().replace(/\s+/g,"_").toLowerCase());return rows.slice(1).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]||""]))).filter(r=>r.name||r.product_name||r.keszitmeny||r.novenyvedo_szer_neve)}
export async function importPlantProtectionCsv(formData:FormData){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(profile?.role!=="advisor")throw new Error("Csak szaktanácsadó/admin indíthat katalógusimportot.");const country=String(formData.get("country_code")||"HU")==="SK"?"SK":"HU",sourceName=String(formData.get("source_name")||"").trim()||`${country} hivatalos növényvédőszer-katalógus`,sourceUrl=String(formData.get("source_url")||"").trim(),notes=String(formData.get("notes")||"").trim(),csv=String(formData.get("csv")||"");const rows=parseCsv(csv);if(!rows.length)throw new Error("Nem találtam importálható sort. Ellenőrizd, hogy az első sor fejléc legyen, utána jöjjenek az adatsorok.");const{data,error}=await supabase.rpc("import_plant_protection_catalog",{p_country_code:country,p_source_name:sourceName,p_source_url:sourceUrl,p_rows:rows,p_notes:notes});if(error)throw new Error(error.message);revalidatePath("/admin/plant-protection-import");revalidatePath("/operations");return data}
