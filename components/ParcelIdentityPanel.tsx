import {saveParcelIdentity} from "@/app/admin/map/actions";

type Props={fieldId:string;settlement:string|null;parcelNumber:string|null;meparBlockId:string|null;externalParcelId:string|null;geometrySource:string|null};

export function ParcelIdentityPanel(p:Props){
 const officialReady=!!(p.settlement&&p.parcelNumber);
 return <section className="panel" style={{marginTop:14}}>
  <div className="panel-heading"><div><span className="eyebrow">HIVATALOS FÖLDRÉSZLET-AZONOSÍTÁS</span><h2>Helyrajzi szám / MePAR / külső térképi forrás</h2></div><span className="user-pill">{officialReady?"HRSZ azonosító rögzítve":"Azonosításra vár"}</span></div>
  <p style={{color:"#6f7c74",lineHeight:1.6}}>Itt tároljuk azokat az azonosítókat, amelyekkel később a hivatalos földrészlet-geometria automatikusan behúzható. A rendszer térképe és poligonkezelése már készen áll; a következő lépés a választott hivatalos adatszolgáltató csatlakoztatása.</p>
  <form action={saveParcelIdentity} className="admin-form" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}>
   <input type="hidden" name="field_id" value={p.fieldId}/>
   <label>Település<input name="settlement" defaultValue={p.settlement||""} placeholder="pl. Nagykáta"/></label>
   <label>Helyrajzi szám<input name="parcel_number" defaultValue={p.parcelNumber||""} placeholder="pl. 0123/4"/></label>
   <label>MePAR blokkazonosító<input name="mepar_block_id" defaultValue={p.meparBlockId||""} placeholder="ha rendelkezésre áll"/></label>
   <label>Külső földrészlet-azonosító<input name="external_parcel_id" defaultValue={p.externalParcelId||""} placeholder="API/GML szolgáltató azonosítója"/></label>
   <label>Geometria forrása<select name="geometry_source" defaultValue={p.geometrySource||"manual"}><option value="manual">Kézi rajzolás</option><option value="official_cadastral">Hivatalos ingatlan-nyilvántartási adat</option><option value="mepar">MePAR</option><option value="gml_import">E-ING / GML import</option><option value="external_api">Külső API</option></select></label>
   <div style={{alignSelf:"end"}}><button className="btn btn-primary" type="submit">Földrészlet-azonosítók mentése</button></div>
  </form>
  <div style={{marginTop:14,padding:14,border:"1px solid #dfe5df",borderRadius:12,background:"#f8faf8"}}><strong>Külső adatkapcsolat állapota</strong><p style={{margin:"6px 0 0",color:"#6f7c74"}}>A fogadó adatmodell kész. Amikor megvan a használható hivatalos API vagy GML-adatszolgáltatás, annak adaptere a település + helyrajzi szám alapján tölti majd ki a poligont, középpontot és külső azonosítót.</p></div>
 </section>;
}
