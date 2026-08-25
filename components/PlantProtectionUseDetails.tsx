"use client";

export type DetailedPlantProtectionUse={
  crop:string;
  target:string|null;
  dose_min:number|null;
  dose_max:number|null;
  dose_unit:string|null;
  application_method:string|null;
  phi_days:number|null;
  bbch_min?:number|null;
  bbch_max?:number|null;
  max_applications?:number|null;
  application_interval_days?:number|null;
  water_volume_min?:number|null;
  water_volume_max?:number|null;
  application_timing?:string|null;
  restrictions?:string|null;
  source_reference?:string|null;
};

function range(min:number|null|undefined,max:number|null|undefined,unit=""){
  if(min==null&&max==null)return null;
  if(min!=null&&max!=null&&min!==max)return `${min}–${max}${unit?` ${unit}`:""}`;
  return `${max??min}${unit?` ${unit}`:""}`;
}

export function PlantProtectionUseDetails({use,country}:{use:DetailedPlantProtectionUse|null|undefined;country:"HU"|"SK"}){
  if(!use)return null;
  const dose=range(use.dose_min,use.dose_max,use.dose_unit||"");
  const bbch=range(use.bbch_min,use.bbch_max);
  const water=range(use.water_volume_min,use.water_volume_max,"l/ha");
  const detailed=country==="SK"&&(bbch||water||use.max_applications!=null||use.application_interval_days!=null||use.application_timing||use.restrictions);
  return <div className="operation-wide" style={{padding:14,border:`1px solid ${detailed?"#9ec5a6":"#dce5dc"}`,borderRadius:12,background:detailed?"#f5fbf6":"#fafcfb",fontSize:13,lineHeight:1.55}}>
    <b>{country==="SK"?"🇸🇰 ÚKSÚP engedélyezett felhasználási részletek":"Engedélyezett felhasználási részletek"}</b>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:8,marginTop:10}}>
      <div><span style={{color:"#607066"}}>Kultúra</span><br/><b>{use.crop}</b></div>
      {use.target&&<div><span style={{color:"#607066"}}>Cél / károsító</span><br/><b>{use.target}</b></div>}
      {dose&&<div><span style={{color:"#607066"}}>Engedélyezett dózis</span><br/><b>{dose}</b></div>}
      {use.application_method&&<div><span style={{color:"#607066"}}>Kijuttatás</span><br/><b>{use.application_method}</b></div>}
      {use.phi_days!=null&&<div><span style={{color:"#607066"}}>Élelmezés-egészségügyi várakozási idő</span><br/><b>{use.phi_days} nap</b></div>}
      {bbch&&<div><span style={{color:"#607066"}}>BBCH tartomány</span><br/><b>{bbch}</b></div>}
      {use.max_applications!=null&&<div><span style={{color:"#607066"}}>Max. kezelésszám</span><br/><b>{use.max_applications}</b></div>}
      {use.application_interval_days!=null&&<div><span style={{color:"#607066"}}>Kezelések közötti minimum</span><br/><b>{use.application_interval_days} nap</b></div>}
      {water&&<div><span style={{color:"#607066"}}>Vízmennyiség</span><br/><b>{water}</b></div>}
    </div>
    {use.application_timing&&<p style={{margin:"10px 0 0"}}><b>Alkalmazási idő:</b> {use.application_timing}</p>}
    {use.restrictions&&<div style={{marginTop:10,padding:10,border:"1px solid #e0b85d",borderRadius:9,background:"#fffaf0"}}><b>⚠ Korlátozás / külön feltétel:</b> {use.restrictions}</div>}
    {country==="SK"&&<p style={{margin:"10px 0 0",color:"#607066"}}>Forrás: {use.source_reference||"ÚKSÚP ISPOR"}. A kijuttatás előtt a hatályos szlovák engedélyokirat és az ÚKSÚP aktuális adata az irányadó.</p>}
  </div>;
}
