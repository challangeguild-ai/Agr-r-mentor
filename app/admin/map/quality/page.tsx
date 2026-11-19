import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {assessFieldBoundary} from "@/lib/fieldBoundaryQuality";
import {AdminNav} from "@/components/AdminNav";

const PAGE_SIZE=50;
type State="missing"|"point"|"warning"|"bounded"|"invalid";
const styles:Record<State,{label:string;color:string}>={
  missing:{label:"Nincs térképi hely",color:"#a43e2c"},
  point:{label:"Csak helypont",color:"#8b731e"},
  warning:{label:"Ellenőrzendő eltérés",color:"#a64d25"},
  bounded:{label:"Poligon rögzítve",color:"#2f7430"},
  invalid:{label:"Hibás régi poligon",color:"#a43e2c"}
};

export default async function FieldQualityOverview({searchParams}:{searchParams:Promise<{page?:string}>}){
  const {page:rawPage}=await searchParams;
  const parsed=Number(rawPage);
  const page=Number.isSafeInteger(parsed)&&parsed>=1&&parsed<=1000?parsed:1;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:me}=await supabase.from("profiles").select("role,system_role").eq("id",user.id).maybeSingle();
  if(me?.role!=="advisor"||me?.system_role==="admin")redirect("/dashboard");

  const {data:fields,count,error}=await supabase.from("fields")
    .select("id,name,farm_id,area_ha,center_lat,center_lng,boundary_geojson",{count:"exact"})
    .order("name").order("id").range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  const farmIds=[...new Set((fields??[]).map(field=>field.farm_id))];
  const {data:farms}=farmIds.length?await supabase.from("farms").select("id,name").in("id",farmIds):{data:[]};
  const farmNames=new Map((farms??[]).map(farm=>[farm.id,farm.name]));

  const assessments=(fields??[]).map(field=>{
    let state:State="bounded",note="";
    if(!field.boundary_geojson){state=field.center_lat==null||field.center_lng==null?"missing":"point"}
    else{
      try{
        const quality=assessFieldBoundary({geometry:field.boundary_geojson,oldLat:field.center_lat,oldLng:field.center_lng,declaredHa:field.area_ha});
        if(quality.issues.length){state="warning";note=quality.issues.map(x=>x.title).join(" · ")}
        else note=`Kb. ${quality.estimatedHa?.toLocaleString("hu-HU",{maximumFractionDigits:2})} ha · ${quality.vertices} töréspont`;
      }catch{state="invalid";note="A rögzített geometriát nem sikerült értelmezni."}
    }
    return{field,state,note};
  });
  const counts=(Object.keys(styles) as State[]).map(state=>({state,count:assessments.filter(row=>row.state===state).length}));
  const total=count??0,hasPrev=page>1,hasNext=page*PAGE_SIZE<total;

  return <main className="admin-shell">
    <header className="admin-header"><div><span className="eyebrow">FÖLDTÁBLA-ADATMINŐSÉG</span><h1>Térképi hiányosságok áttekintése</h1><p>Hol hiányzik még a határ, hol van csak helypont, és mely rögzített poligonokat érdemes ellenőrizni? Minden jelzés tájékoztató, nem hivatalos földmérés.</p></div></header>
    <AdminNav active="map-quality"/>
    {error?<section className="panel"><p role="alert">A földtáblák most nem kérhetők le. A nyilvántartási adatok nem változtak.</p></section>:<>
      <section className="panel" style={{marginBottom:14}}><div className="panel-heading"><div><span className="eyebrow">ÁLLAPOTKÉP</span><h2>{total} földtábla · {page}. oldal</h2></div><small>Oldalanként {PAGE_SIZE} tábla, a számlálók az aktuális oldalra vonatkoznak.</small></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginTop:14}}>{counts.map(({state,count})=><div key={state} style={{padding:12,border:"1px solid #e1e8df",borderRadius:10}}><strong style={{display:"block",fontSize:26,color:styles[state].color}}>{count}</strong><small>{styles[state].label}</small></div>)}</div>
        <p style={{fontSize:13,color:"#526253",marginTop:12}}>A területadatot a tárolt poligonnal vetjük össze. Szomszédos táblák lehetséges átfedését külön, a javaslat jóváhagyási képernyőjén vizsgáljuk — ez a lista nem állít teljes topológiai hitelesítést.</p>
      </section>
      <section className="panel"><div className="panel-heading"><h2>Táblák ellenőrzési sorrendben</h2><Link className="ghost-btn" href="/admin/map/proposals">Beküldött javaslatok →</Link></div>
        {assessments.length===0?<p className="empty-state">Ezen az oldalon nincs földtábla.</p>:<div className="task-list" style={{marginTop:14}}>{[...assessments].sort((a,b)=>["invalid","missing","warning","point","bounded"].indexOf(a.state)-["invalid","missing","warning","point","bounded"].indexOf(b.state)).map(({field,state,note})=><div className="task-row" key={field.id} style={{gap:12,flexWrap:"wrap"}}><span className="dot normal"/><div style={{minWidth:170,flex:1}}><strong>{field.name}</strong><small>{farmNames.get(field.farm_id)||"Gazdaság"}{field.area_ha?` · ${field.area_ha} ha nyilvántartva`:""}</small>{note&&<small style={{display:"block",marginTop:4}}>{note}</small>}</div><span className="user-pill" style={{color:styles[state].color}}>{styles[state].label}</span><Link className="ghost-btn" href={`/admin/map?field=${field.id}`}>Térkép megnyitása →</Link></div>)}</div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:18}}><span style={{fontSize:13,color:"#6f7c74"}}>{total===0?0:(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,total)} / {total} tábla</span><div style={{display:"flex",gap:8}}>{hasPrev&&<Link className="ghost-btn" href={`/admin/map/quality?page=${page-1}`}>← Előző</Link>}{hasNext&&<Link className="ghost-btn" href={`/admin/map/quality?page=${page+1}`}>Következő →</Link>}</div></div>
      </section>
    </>}
  </main>;
}
