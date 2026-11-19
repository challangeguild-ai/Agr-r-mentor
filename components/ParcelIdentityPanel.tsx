import {saveParcelIdentity} from "@/app/admin/map/actions";

type Props={fieldId:string;settlement:string|null;parcelNumber:string|null;meparBlockId:string|null;externalParcelId:string|null;geometrySource:string|null};

export function ParcelIdentityPanel(p:Props){
 const officialReady=!!(p.settlement&&p.parcelNumber);
 return <section className="panel" style={{marginTop:14}}>
  <div className="panel-heading"><div><span className="eyebrow">VÁLASZTHATÓ FÖLDRÉSZLET-AZONOSÍTÁS</span><h2>Helyrajzi szám / MePAR / külső térképi forrás</h2></div><span className="user-pill">{officialReady?"HRSZ azonosító rögzítve":"Azonosításra vár"}</span></div>
  <p style={{color:"#6f7c74",lineHeight:1.6}}>Ezek az adatok nem kötelezők a térképi megjelenítéshez. A település és a helyrajzi szám egyelőre azonosító adat: elmentésük önmagában nem tölti le a hivatalos határt. A határt az alábbi térképnél OSM-javaslatból, saját GeoJSON-fájlból vagy kézi rajzzal adhatod meg; ezek mind választható lehetőségek, a helypont is menthető. A hivatalos HRSZ-lekéréshez adatszolgáltatói kapcsolat szükséges.</p>
  <form action={saveParcelIdentity} className="admin-form" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}>
   <input type="hidden" name="field_id" value={p.fieldId}/>
   <label>Település<input name="settlement" defaultValue={p.settlement||""} placeholder="pl. Nagykáta"/></label>
   <label>Helyrajzi szám<input name="parcel_number" defaultValue={p.parcelNumber||""} placeholder="pl. 0123/4"/></label>
   <label>MePAR blokkazonosító<input name="mepar_block_id" defaultValue={p.meparBlockId||""} placeholder="ha rendelkezésre áll"/></label>
   <label>Külső földrészlet-azonosító<input name="external_parcel_id" defaultValue={p.externalParcelId||""} placeholder="API/GML szolgáltató azonosítója"/></label>
   <div style={{color:"#536457",fontSize:13,alignSelf:"center"}}>Rögzített táblahatár eredete: <strong>{({manual:"kézi rajz",cadastral:"ingatlan-nyilvántartási adat",mepar:"MePAR",external:"külső térképi javaslat vagy fájl"} as Record<string,string>)[p.geometrySource||"manual"]||"ismeretlen"}</strong></div>
   <div style={{alignSelf:"end"}}><button className="btn btn-primary" type="submit">Földrészlet-azonosítók mentése</button></div>
  </form>
  <div style={{marginTop:14,padding:14,border:"1px solid #dfe5df",borderRadius:12,background:"#f8faf8"}}><strong>Külső adatkapcsolat állapota</strong><p style={{margin:"6px 0 0",color:"#6f7c74"}}>Automatikus HRSZ → poligon lekérés még nincs bekötve. Az OSM-javaslat vagy határfájl felhasználásánál ellenőrizni kell, hogy az adat valóban ehhez a táblához tartozik-e, és hogy az ingatlan-nyilvántartási földrészlet határa megegyezik-e a tényleges művelt területtel.</p></div>
 </section>;
}
