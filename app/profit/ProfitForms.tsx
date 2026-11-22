"use client";

import {useRouter} from "next/navigation";
import {useActionState,useEffect,useRef} from "react";
import {addProfitCost,addProfitSale,deleteProfitEntry,saveProfitSeason} from "./actions";
import type {ProfitActionState} from "./actions";
import styles from "./profit.module.css";

const blank:ProfitActionState={ok:false,message:"",revision:0};
const costCategories=["Vetőmag","Műtrágya","Növényvédőszer","Üzemanyag","Gép és bérmunka","Munkabér","Földbérlet","Öntözés","Szállítás és tárolás","Egyéb"];
export type ProfitFieldOption={id:string;farmName:string;name:string;areaHa:number;crop:string;year:number};
export type ProfitSeasonOption={id:string;field_id:string;season_year:number;crop_name:string;harvested_tonnes:number;expected_price_huf_per_tonne:number};

function Feedback({state}:{state:ProfitActionState}){
 if(!state.message)return null;
 return <p className={`${styles.feedback} ${state.ok?styles.success:styles.error}`} role={state.ok?"status":"alert"}>{state.message}</p>;
}

export function ProfitSeasonForm({fields,selected,defaultYear}:{fields:ProfitFieldOption[];selected?:ProfitSeasonOption;defaultYear:number}){
 const router=useRouter();
 const[state,action,pending]=useActionState(saveProfitSeason,blank);
 const selectedField=fields.find(field=>field.id===selected?.field_id)??fields[0];
 useEffect(()=>{if(state.ok&&state.navigateTo)router.push(state.navigateTo)},[router,state.ok,state.revision,state.navigateTo]);
 return <form action={action} className={styles.form}>
  <div className={styles.formHeading}><h2>{selected?"Termesztési év módosítása":"Termesztési év felvétele"}</h2><small>A betakarított mennyiség és a várható eladási ár később is pontosítható.</small></div>
  <div className={styles.formGrid}>
   {selected?<><input type="hidden" name="field_id" value={selected.field_id}/><label>Földtábla<input value={`${selectedField?.farmName??"Gazdaság"} · ${selectedField?.name??"Földtábla"}`} readOnly/></label></>:<label>Földtábla<select name="field_id" defaultValue={selectedField?.id} required>{fields.map(field=><option key={field.id} value={field.id}>{field.farmName} · {field.name} ({field.areaHa.toLocaleString("hu-HU")} ha)</option>)}</select></label>}
   <label>Év<input type="number" name="season_year" min="2000" max="2100" step="1" required defaultValue={selected?.season_year??defaultYear} readOnly={Boolean(selected)}/></label>
   <label>Termesztett növény<input name="crop_name" maxLength={160} required defaultValue={selected?.crop_name??selectedField?.crop??""} placeholder="pl. búza, kukorica"/></label>
   <label>Betakarított mennyiség (tonna)<input type="number" name="harvested_tonnes" min="0" step="0.001" required defaultValue={selected?.harvested_tonnes??0}/></label>
   <label>Várható eladási ár (Ft/tonna)<input type="number" name="expected_price_huf_per_tonne" min="0" step="1" required defaultValue={selected?.expected_price_huf_per_tonne??0}/></label>
  </div>
  <button type="submit" className={styles.primary} disabled={pending||!fields.length}>{pending?"Mentés...":selected?"Adatok frissítése":"Termesztési év létrehozása"}</button>
  <Feedback state={state}/>
 </form>;
}

export function ProfitCostForm({seasonId}:{seasonId:string}){
 const[state,action,pending]=useActionState(addProfitCost,blank),formRef=useRef<HTMLFormElement>(null);
 useEffect(()=>{if(state.ok)formRef.current?.reset()},[state.ok,state.revision]);
 return <form ref={formRef} action={action} className={styles.form}>
  <input type="hidden" name="season_id" value={seasonId}/>
  <h3>Új költség rögzítése</h3>
  <div className={styles.formGrid}>
   <label>Költség típusa<select name="category" required>{costCategories.map(name=><option value={name} key={name}>{name}</option>)}</select></label>
   <label>Összeg (Ft)<input type="number" name="amount_huf" min="1" step="1" required placeholder="pl. 185000"/></label>
   <label>Dátum<input type="date" name="occurred_on" required defaultValue={new Date().toISOString().slice(0,10)}/></label>
   <label>Megnevezés<input name="description" maxLength={240} placeholder="pl. tavaszi műtrágya"/></label>
  </div>
  <button type="submit" className={styles.primary} disabled={pending}>{pending?"Mentés...":"Költség hozzáadása"}</button>
  <Feedback state={state}/>
 </form>;
}

export function ProfitSaleForm({seasonId,availableTonnes}:{seasonId:string;availableTonnes:number}){
 const[state,action,pending]=useActionState(addProfitSale,blank),formRef=useRef<HTMLFormElement>(null);
 useEffect(()=>{if(state.ok)formRef.current?.reset()},[state.ok,state.revision]);
 return <form ref={formRef} action={action} className={styles.form}>
  <input type="hidden" name="season_id" value={seasonId}/>
  <div className={styles.formHeading}><h3>Terményértékesítés</h3><small>Még nyilvántartott készlet: {availableTonnes.toLocaleString("hu-HU",{maximumFractionDigits:3})} t</small></div>
  <div className={styles.formGrid}>
   <label>Eladott mennyiség (tonna)<input type="number" name="quantity_tonnes" min="0.001" step="0.001" max={availableTonnes>0?availableTonnes:undefined} required placeholder="pl. 3,5"/></label>
   <label>Tényleges ár (Ft/tonna)<input type="number" name="price_huf_per_tonne" min="0" step="1" required placeholder="pl. 85000"/></label>
   <label>Eladás dátuma<input type="date" name="occurred_on" required defaultValue={new Date().toISOString().slice(0,10)}/></label>
   <label>Megjegyzés / vevő<input name="description" maxLength={240} placeholder="pl. terményfelvásárló"/></label>
  </div>
  <button type="submit" className={styles.primary} disabled={pending||availableTonnes<=0}>{pending?"Mentés...":"Eladás rögzítése"}</button>
  {availableTonnes<=0&&<p className={styles.hint}>Előbb rögzíts betakarított mennyiséget, vagy már nincs eladható készlet.</p>}
  <Feedback state={state}/>
 </form>;
}

export function ProfitDeleteButton({entryId}:{entryId:string}){
 const[state,action,pending]=useActionState(deleteProfitEntry,blank);
 return <form action={action} className={styles.deleteForm} onSubmit={event=>{if(!window.confirm("Biztosan végleg törlöd ezt a pénzügyi tételt?"))event.preventDefault()}}>
  <input type="hidden" name="entry_id" value={entryId}/>
  <button type="submit" disabled={pending} aria-label="Pénzügyi tétel törlése">{pending?"Törlés...":"Törlés"}</button>
  <Feedback state={state}/>
 </form>;
}
