import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import {FieldsOverviewMap} from "@/components/FieldsOverviewMap";
import {BlockHelpButton} from "@/components/GuidedTour";
import styles from "./fields.module.css";

function statusLabel(status:string|null){if(status==="inactive")return"Inaktív";if(status==="archived")return"Archivált";return"Aktív"}
function inspectionLabel(v:string|null|undefined){if(v==="good")return"Jó";if(v==="attention")return"Figyelmet igényel";if(v==="critical")return"Kritikus";return"Nincs szemle"}
type SearchParams=Promise<{view?:string}>;

export default async function FieldsPage({searchParams}:{searchParams:SearchParams}){
 const{view="all"}=await searchParams;
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role,system_role,full_name").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");if(profile?.role==="advisor")redirect("/admin/map");

 const{data:farms,error:farmError}=await supabase.from("farms").select("id,name,settlement").eq("owner_id",user.id).order("name");
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
 const active=(fields??[]).filter(f=>f.status!=="inactive"&&f.status!=="archived").length;
 const attentionIds=new Set((fields??[]).filter(field=>{const ins=latestInspection.get(field.id);const important=(tasks??[]).some(t=>t.field_id===field.id&&t.status!=="done"&&(t.priority==="urgent"||t.priority==="high"));return important||ins?.condition==="attention"||ins?.condition==="critical"}).map(f=>f.id));
 const noTaskIds=new Set((fields??[]).filter(field=>!(tasks??[]).some(t=>t.field_id===field.id&&t.status!=="done")).map(f=>f.id));
 const visibleFields=(fields??[]).filter(field=>view==="active"?field.status!=="inactive"&&field.status!=="archived":view==="attention"?attentionIds.has(field.id):view==="no-tasks"?noTaskIds.has(field.id):view==="archived"?field.status==="archived"||field.status==="inactive":true);
 const tabs=[["all","Összes"],["active","Aktív"],["attention","Figyelmet igényel"],["no-tasks","Nincs nyitott teendő"],["archived","Inaktív"]] as const;
 const overview=visibleFields.map(f=>({id:f.id,name:f.name,farmName:farmMap.get(f.farm_id)?.name||"Gazdaság",areaHa:f.area_ha,crop:f.current_crop,lat:f.center_lat,lng:f.center_lng,boundary:f.boundary_geojson,href:`/fields/${f.id}`,status:latestInspection.get(f.id)?.condition||undefined}));

 return <div className="app-shell farmer-app">
  <Sidebar active="fields" userName={profile?.full_name||"Gazdálkodó"}/>
  <main className={`dashboard ${styles.page}`}>
   <FarmerTopbar userName={profile?.full_name||"Gazdálkodó"} placeholder="Keresés táblák, növények vagy feladatok között…"/>
   <section className={styles.titleRow}>
    <div><h1>Táblák</h1><p>Kezeld a tábláidat, nézd meg adataikat és tervezd a következő lépéseket.</p></div>
    <Link className={styles.primary} href="/map">+ Új tábla</Link>
   </section>

   <section className={styles.toolbar}>
    <div className={styles.filters}>{tabs.map(([key,label])=><Link key={key} className={view===key?styles.active:""} href={`/fields?view=${key}`}>{label}</Link>)}</div>
    <div className={styles.toolbarActions}><Link className={styles.mapButton} href="/map">Térkép</Link><BlockHelpButton label="A táblajegyzék magyarázata" content={{title:"Táblák",body:"A bal oldali listában a földtáblák fő adatait, a jobb oldalon pedig az elhelyezkedésüket látod. A státuszok a legfrissebb szakmai állapot alapján segítenek priorizálni.",important:"A térképi és állapotjelzés döntéstámogatás; nem önálló szakmai diagnózis."}}/></div>
   </section>

   <section className={styles.workspace}>
    <div className={styles.list}>
     {visibleFields.length?visibleFields.map((field,index)=>{const farm=farmMap.get(field.farm_id);const ins=latestInspection.get(field.id);const fieldTasks=(tasks??[]).filter(t=>t.field_id===field.id&&t.status!=="done");const state=ins?.condition||"none";return <Link className={styles.fieldCard} href={`/fields/${field.id}`} key={field.id}>
      <span className={`${styles.thumb} ${styles["thumb"+(index%3)]}`} aria-hidden="true"><i/><i/></span>
      <div className={styles.fieldMain}><div className={styles.fieldHead}><div><strong>{field.name}</strong><small>{field.area_ha?`${field.area_ha} ha`:"—"} · {field.current_crop||"Nincs kultúra"}</small></div><span className={`${styles.status} ${state==="critical"?styles.critical:state==="attention"?styles.attention:state==="good"?styles.good:styles.neutral}`}>{inspectionLabel(state)}</span></div>
       <div className={styles.fieldMeta}><span>{farm?.name||"Gazdaság"}</span><span>{fieldTasks.length} nyitott teendő</span><span>{ins?.inspected_at?new Date(ins.inspected_at).toLocaleDateString("hu-HU"):"Nincs szemle"}</span></div>
      </div><b className={styles.chevron}>›</b>
     </Link>}):<div className={styles.empty}>Ebben a nézetben nincs földtábla.</div>}
    </div>
    <div className={styles.map}><FieldsOverviewMap fields={overview} compact/></div>
   </section>
  </main>
 </div>;
}
