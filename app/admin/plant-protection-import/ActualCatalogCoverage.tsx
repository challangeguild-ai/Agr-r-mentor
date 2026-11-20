type Coverage={products:number;uses:number}|null;

/** Live counters: old importer status is not proof of permit-use coverage. */
export function ActualCatalogCoverage({hu,sk}:{hu:Coverage;sk:Coverage}){
 return <section className="panel" aria-label="Tényleges növényvédelmi adatlefedettség">
  <div className="panel-heading"><div><span className="eyebrow">ELLENŐRZÖTT ÁLLAPOT</span><h2>Tényleges engedélyadat-lefedettség</h2></div></div>
  <div className="stats-grid">{([{"name":"Magyarország",current:hu},{"name":"Szlovákia",current:sk}]).map(({name,current})=><article className="stat-card" key={name}><span>{name}</span><strong>{current?.products??"—"} készítmény</strong><small>{current?`${current.uses} felhasználási sor az adatbázisban`:"A friss adatok nem ellenőrizhetők"}</small></article>)}</div>
  <p style={{marginTop:12}}>Ezek az aktuális adatbázisból számolt értékek. Az alábbi korábbi importkártyák „ready” állapota csak egy importfolyamat sikerét jelenti, nem a teljes engedélykatalógus készültségét.</p>
  {hu&&hu.uses===0&&<div className="error-box" role="alert" style={{marginTop:12}}><b>A magyar permetezési adatok hiányosak.</b><p>{hu.products} aktív készítményhez nincs ellenőrzött kultúra–cél–dózis felhasználási sor. A NÉBIH visszavont/lejárt lista nem tartalmazza ezeket az adatokat. A műveletfelvitel a hiányos felhasználásokat nem mentheti.</p><a href="https://novenyvedoszer.nebih.gov.hu/Engedelykereso/kereso" target="_blank" rel="noopener noreferrer">NÉBIH engedélykereső megnyitása</a></div>}
 </section>;
}
