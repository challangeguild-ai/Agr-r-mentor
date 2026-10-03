import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import {BlockHelpButton} from "@/components/GuidedTour";
import {OperationForm} from "@/components/OperationForm";
import {OperationDeleteButton} from "@/components/OperationDeleteButton";
import {OperationExportButton} from "@/components/OperationExportButton";
import {operationLabel} from "@/lib/operations";
import styles from "./operations.module.css";

type SP=Promise<{type?:string;field?:string}>;
function dateHu(v:string){return new Date(`${v}T12:00:00`).toLocaleDateString("hu-HU")}
function opIcon(type:string){if(type==="spraying"||type==="plant_protection")return"✦";if(type==="fertilizing")return"◈";if(type==="sowing")return"✣";if(type==="harvest")return"▥";if(type==="irrigation")return"≈";return"●"}

export default async function OperationsPage({searchParams}:{searchParams:SP}){
 const{type="all",field=""}=await searchParams;
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role,full_name").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");
 if(profile?.role==="advisor")redirect(field?`/admin/operations?field=${encodeURIComponent(field)}`:"/admin/operations");

 const{data:farms}=await supabase.from("farms").select("id,name,country_code").eq("owner_id",user.id).order("name");
 const farmIds=(farms??[]).map(f=>f.id);
 const[{data:fields},{data:machines}]=farmIds.length?await Promise.all([
  supabase.from("fields").select("id,name,farm_id,area_ha").in("farm_id",farmIds).order("name"),
  supabase.from("machines").select("id,farm_id,name,machine_type,manufacturer,model").in("farm_id",farmIds).eq("active",true).order("name")
 ]):[{data:[]},{data:[]}];

 const fieldIds=(fields??[]).map(f=>f.id),safeField=fieldIds.includes(field)?field:"";
 const{data:rows,error}=fieldIds.length?await supabase.from("field_operations").select("id,farm_id,field_id,operation_date,operation_type,country_code,subtype,product_name,authorization_number,crop,target,active_ingredient,dose,dose_unit,dose_mode,official_dose_max,quantity,quantity_unit,treated_area,machine_name,operator_name,weather,notes,catalog_mode,created_by,regulatory_category,approval_required,approval_status,approver_name,approved_at").in("field_id",fieldIds).order("operation_date",{ascending:false}).limit(500):{data:[],error:null};
 if(error)throw new Error(error.message);

 const all=rows??[],visible=all.filter(e=>(type==="all"||e.operation_type===type)&&(!safeField||e.field_id===safeField));
 const fieldMap=new Map((fields??[]).map(f=>[f.id,f])),farmMap=new Map((farms??[]).map(f=>[f.id,f]));
 const options=(fields??[]).map(f=>{const fm=farmMap.get(f.farm_id);return{id:f.id,farmId:f.farm_id,name:f.name,farmName:fm?.name||"Gazdaság",areaHa:f.area_ha,countryCode:(fm?.country_code==="SK"?"SK":"HU") as "HU"|"SK"}});
 const machineOptions=(machines??[]).map(m=>({id:m.id,farmId:m.farm_id,name:m.name,detail:[m.machine_type,m.manufacturer,m.model].filter(Boolean).join(" · ")}));
 const tabs=[["all","Összes"],["spraying","Permetezés"],["plant_protection","Növényvédelem"],["fertilizing","Tápanyag"],["sowing","Vetés"],["soil_work","Talajmunka"],["harvest","Betakarítás"],["irrigation","Öntözés"],["mowing","Kaszálás"],["other","Egyéb"]] as const;
 const href=(t=type,f=safeField)=>`/operations?type=${t}${f?`&field=${encodeURIComponent(f)}`:""}`;
 const exportRows=visible.map(e=>{const fr=fieldMap.get(e.field_id),fm=farmMap.get(e.farm_id);return{date:dateHu(e.operation_date),farm:fm?.name||"",field:fr?.name||"",country:e.country_code,type:operationLabel(e.operation_type),subtype:e.subtype,product:e.product_name,authorizationNumber:e.authorization_number,crop:e.crop,target:e.target,activeIngredient:e.active_ingredient,dose:e.dose,doseUnit:e.dose_unit,quantity:e.quantity,quantityUnit:e.quantity_unit,treatedArea:e.treated_area,machine:e.machine_name,operator:e.operator_name,weather:e.weather,notes:e.notes,catalogMode:e.catalog_mode}});

 return <div className="app-shell farmer-app">
  <Sidebar active="operations" userName={profile?.full_name||"Gazdálkodó"}/>
  <main className={`dashboard ${styles.page}`}>
   <FarmerTopbar userName={profile?.full_name||"Gazdálkodó"} placeholder="Keresés műveletek, táblák vagy anyagok között…"/>
   <section className={styles.titleRow}>
    <div><h1>Műveleti napló</h1><p>Rögzítsd és kövesd a mezőgazdasági műveleteidet egy egységes naplóban.</p></div>
    <div className={styles.titleActions}><OperationExportButton rows={exportRows}/><a className={styles.primary} href="#uj-muvelet">+ Új művelet</a></div>
   </section>

   <section className={styles.toolbar}>
    <div className={styles.filters}>{tabs.map(([k,l])=><Link key={k} className={type===k?styles.active:""} href={href(k)}>{l}</Link>)}</div>
    <div className={styles.toolbarMeta}><span>{visible.length} bejegyzés</span><BlockHelpButton label="A gazdálkodási napló magyarázata" content={{title:"Műveleti napló",body:"A napló a korábban mentett műveleteket mutatja dátummal, táblával, anyaggal, dózissal, végrehajtóval és jóváhagyási állapottal.",important:"A jóváhagyásra váró tétel még nem lezárt végrehajtási állapot."}}/></div>
   </section>

   <section className={styles.tablePanel}>
    <div className={styles.tableHead}><span>Dátum</span><span>Tábla</span><span>Művelet</span><span>Input / Anyag</span><span>Mennyiség</span><span>Megjegyzés</span><span>Státusz</span><span/></div>
    <div className={styles.tableBody}>
     {visible.length?visible.map(e=>{const fr=fieldMap.get(e.field_id);const input=e.product_name||e.subtype||"—";const amount=e.dose!=null?`${e.dose} ${e.dose_unit||""}`:e.quantity!=null?`${e.quantity} ${e.quantity_unit||""}`:e.treated_area!=null?`${e.treated_area} ha`:"—";const status=e.approval_status==="pending"?"Jóváhagyásra vár":e.approval_status==="approved"?"Jóváhagyva":"Bejegyezve";return <article className={styles.row} key={e.id}>
      <time>{dateHu(e.operation_date)}</time>
      <Link href={`/fields/${e.field_id}`}><strong>{fr?.name||"Földtábla"}</strong><small>{fr?.area_ha?`${fr.area_ha} ha`:""}</small></Link>
      <div className={styles.op}><span>{opIcon(e.operation_type)}</span><strong>{operationLabel(e.operation_type)}</strong></div>
      <div className={styles.input}>{input}</div>
      <div className={styles.note}>{e.notes||e.target||e.crop||"—"}</div>
      <span className={`${styles.status} ${e.approval_status==="pending"?styles.pending:styles.done}`}>{status}</span>
      <div className={styles.more}><Link href={`/operations/${e.id}`}>•••</Link>{e.created_by===user.id&&<OperationDeleteButton id={e.id}/>}</div>
     </article>}):<div className={styles.empty}>Ebben a kategóriában még nincs rögzített művelet.</div>}
    </div>
   </section>

   <section id="uj-muvelet" className={styles.formPanel}>
    <div className={styles.formHead}><div><span>ÚJ BEJEGYZÉS</span><h2>Művelet rögzítése</h2></div><BlockHelpButton label="A művelet rögzítésének magyarázata" content={{title:"Új gazdálkodási művelet",body:"Válaszd ki a földtáblát és a művelettípust, majd add meg a végrehajtási adatokat.",important:"Növényvédelemnél a hivatalos dóziskorlát és az esetleges gazdasági jóváhagyás külön ellenőrzendő."}}/></div>
    <OperationForm fields={options} machines={machineOptions} defaultFieldId={safeField}/>
   </section>
  </main>
 </div>;
}
