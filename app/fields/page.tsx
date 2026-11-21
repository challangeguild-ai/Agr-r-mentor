import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import {FieldsOverviewMap} from "@/components/FieldsOverviewMap";
import {FieldMiniMap} from "@/components/FieldMiniMap";
import {BlockHelpButton} from "@/components/GuidedTour";
import {matchesFieldCatalogQuery} from "@/lib/fieldCatalogSearch";
import styles from "./fields.module.css";

function statusLabel(status:string|null){if(status==="inactive")return"Inaktív";if(status==="archived")return"Archivált";return"Aktív"}
function inspectionLabel(v:string|null|undefined){if(v==="good")return"Jó";if(v==="attention")return"Figyelmet igényel";if(v==="critical")return"Kritikus";return"Nincs szemle"}
type SearchParams=Promise<{view?:string;mode?:string;q?:string}>;

export default async function FieldsPage({searchParams}:{searchParams:SearchParams}){
 const{view:requestedView="active",mode:requestedMode,q:requestedQuery=""}=await searchParams;
 const view=["all","active","attention","no-tasks","archived"].includes(requestedView)?requestedView:"active";
 const mode=requestedMode==="map"||requestedMode==="list"?requestedMode:"auto";
 const query=typeof requestedQuery==="string"?requestedQuery.trim().slice(0,120):"";
 const querySuffix=query?`&q=${encodeURIComponent(query)}`:"";
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role,full_name").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");if(profile?.role==="advisor")redirect("/admin/map");

 const{data:farms,error:farmError}=await supabase.from("farms").select("id,name,settlement").order("name");
 if(farmError)throw new Error(farmError.message);
 const farmIds=(farms??[]).map(f=>f.id);
 const{data:fields,error}=farmIds.length?await supabase.from("fields").select("id,name,farm_id,area_ha,current_crop,crop_year,sowing_date,status,created_at,center_lat,center_lng,boundary_geojson").in("farm_id",farmIds).order("name"):{data:[],error:null};
 if(error)throw new Error(error.message);
 const fieldIds=(fields??[]).map(f=>f.id);
 const[{data:tasks},{data:inspections}]=fieldIds.length?await Promise.all([
  supabase.from("tasks").select("id,field_id,status,due_date,priority").in("field_id",fieldIds).eq("assigned_to",user.id),
  supabase.from("inspections").select("id,field_id,condition,inspected_at").in("field_id",fieldIds).order("inspected_at",{ascending:false})
 ]):[{data:[]},{data:[]}];

 const latestInspection=new Map<string,any>();for(const i of inspections??[])if(!latestInspection.has(i.field_id))latestInspection.set(i.field_id,i);
 const farmMap=new Map((farms??[]).map(f=>[f.id,f]));
 const attentionIds=new Set((fields??[]).filter(field=>{const ins=latestInspection.get(field.id);const important=(tasks??[]).some(t=>t.field_id===field.id&&t.status!=="done"&&(t.priority==="urgent"||t.priority==="high"));return important||ins?.condition==="attention"||ins?.condition==="critical"}).map(f=>f.id));
 const noTaskIds=new Set((fields??[]).filter(field=>!(tasks??[]).some(t=>t.field_id===field.id&&t.status!=="done")).map(f=>f.id));
 const visibleFields=(fields??[]).filter(field=>{
  const inView=view==="active"?field.status!=="inactive"&&field.status!=="archived":view==="attention"?attentionIds.has(field.id):view==="no-tasks"?noTaskIds.has(field.id):view==="archived"?field.status==="archived"||field.status==="inactive":true;
  return inView&&matchesFieldCatalogQuery({...field,farmName:farmMap.get(field.farm_id)?.name},query);
 });
 const tabs=[["all","Összes"],["active","Aktív"],["attention","Figyelmet igényel"],["no-tasks","Nincs nyitott teendő"],["archived","Inaktív"]] as const;
 const overview=visibleFields.map(f=>({id:f.id,name:f.name,farmName:farmMap.get(f.farm_id)?.name||"Gazdaság",areaHa:f.area_ha,crop:f.current_crop,lat:f.center_lat,lng:f.center_lng,boundary:f.boundary_geojson,href:`/fields/${f.id}`,status:f.status==="inactive"||f.status==="archived"?"inactive":latestInspection.get(f.id)?.condition||undefined}));

 return <div className="app-shell farmer-app">
  <Sidebar active="fields" userName={profile?.full_name||"Gazdálkodó"}/>
  <main className={`dashboard ${styles.page}`}>
   <FarmerTopbar userName={profile?.full_name||"Gazdálkodó"} placeholder="Keresés táblák, növények vagy gazdaságok között…" searchAction="/fields" defaultQuery={query} preserveSearchParams={{view,mode}}/>
   <section className={styles.titleRow}>
    <div><h1>Táblák</h1><p>Kezeld a tábláidat, nézd meg adataikat és tervezd a következő lépéseket.</p></div>
    <Link className={styles.primary} href="/map">⌖ Térképi áttekintés</Link>
   </section>

   <section className={styles.toolbar}>
    <nav className={styles.filters} aria-label="Táblák szűrése">{tabs.map(([key,label])=><Link key={key} className={view===key?styles.active:""} aria-current={view===key?"page":undefined} href={`/fields?view=${key}${mode==="auto"?"":`&mode=${mode}`}${querySuffix}`}>{label}</Link>)}</nav>
    <div className={styles.toolbarActions}>
     <nav className={styles.viewSwitch} aria-label="Táblanézet választása">
      <Link href={`/fields?view=${encodeURIComponent(view)}&mode=map${querySuffix}`} className={`${styles.viewOption} ${mode==="map"?styles.viewActive:mode==="auto"?styles.autoMap:""}`} aria-current={mode==="map"?"page":undefined}>▧ Térkép</Link>
      <Link href={`/fields?view=${encodeURIComponent(view)}&mode=list${querySuffix}`} className={`${styles.viewOption} ${mode==="list"?styles.viewActive:mode==="auto"?styles.autoList:""}`} aria-current={mode==="list"?"page":undefined}>☷ Lista</Link>
     </nav>
     <BlockHelpButton label="A táblajegyzék magyarázata" content={{title:"Táblák",body:"A listából megnyithatod a földtáblát. A Térkép és Lista kapcsolóval mobilon is válthatsz a nézetek között.",important:"A térképi és állapotjelzés döntéstámogatás; nem önálló szakmai diagnózis."}}/>
    </div>
   </section>

   <section className={styles.workspace} data-mode={mode} data-help-block="fields-register">
    <div className={styles.list}>
     {visibleFields.length?visibleFields.map(field=>{const farm=farmMap.get(field.farm_id);const ins=latestInspection.get(field.id);const fieldTasks=(tasks??[]).filter(t=>t.field_id===field.id&&t.status!=="done");const state=ins?.condition||"none";const inactive=field.status==="inactive"||field.status==="archived";const cardOutline=inactive?"":state==="critical"?styles.fieldCritical:state==="attention"?styles.fieldAttention:state==="good"?styles.fieldGood:"";return <Link className={`${styles.fieldCard} ${cardOutline}`} href={`/fields/${field.id}`} key={field.id}>
      <FieldMiniMap className={styles.thumb} lat={field.center_lat} lng={field.center_lng} boundary={field.boundary_geojson} label={`${field.name} műholdképe és táblahatára`}/>
      <div className={styles.fieldMain}><div className={styles.fieldHead}><div><strong>{field.name}</strong><small>{field.area_ha?`${field.area_ha} ha`:"—"} · {field.current_crop||"Nincs kultúra"}</small></div><span className={`${styles.status} ${inactive?styles.neutral:state==="critical"?styles.critical:state==="attention"?styles.attention:styles.good}`}>{inactive?statusLabel(field.status):state==="none"?statusLabel(field.status):inspectionLabel(state)}</span></div>
       <div className={styles.fieldMeta}><span>{farm?.name||"Gazdaság"}</span><span>{fieldTasks.length} nyitott teendő</span><span>{ins?.inspected_at?new Date(ins.inspected_at).toLocaleDateString("hu-HU"):"Nincs szemle"}</span></div>
      </div><b className={styles.chevron}>›</b>
     </Link>}):<div className={styles.empty}>{query?"Nincs a keresésnek megfelelő földtábla.":"Ebben a nézetben nincs földtábla."}{query&&<Link href={`/fields?view=${encodeURIComponent(view)}${mode==="auto"?"":`&mode=${mode}`}`}>Keresés törlése</Link>}</div>}
    </div>
    <div className={styles.map}><FieldsOverviewMap fields={overview} compact/></div>
   </section>
  </main>
 </div>;
}
