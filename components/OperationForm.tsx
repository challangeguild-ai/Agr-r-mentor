"use client";

import {useEffect,useMemo,useState} from "react";
import {createFieldOperation} from "@/app/operations/actions";
import {operationTypes} from "@/lib/operations";
import {fertilizerCatalog,nutrientSummary,soilWork,type CountryCode} from "@/lib/operationCatalog";

type FieldOption={id:string;name:string;farmName:string;areaHa:number|null;countryCode?:CountryCode};
type CatalogItem={id:string;name:string;category:string;metadata?:Record<string,unknown>};
type Product={id:string;name:string;authorization_number:string|null;function_type:string|null};
type Use={id:string;product_id:string;crop:string;target:string|null;dose_min:number|null;dose_max:number|null;dose_unit:string|null;application_method:string|null;phi_days:number|null};
type Ingredient={product_id:string;ingredient:string;concentration:number|null;concentration_unit:string|null};
type CatalogResponse={catalog:CatalogItem[];products:Product[];uses:Use[];ingredients?:Ingredient[];error?:string};

export function OperationForm({fields,defaultFieldId=""}:{fields:FieldOption[];defaultFieldId?:string}){
  const initial=fields.find(f=>f.id===defaultFieldId);
  const[busy,setBusy]=useState(false);
  const[loadingCatalog,setLoadingCatalog]=useState(false);
  const[error,setError]=useState("");
  const[type,setType]=useState("spraying");
  const[fieldId,setFieldId]=useState(defaultFieldId);
  const[product,setProduct]=useState("");
  const[productId,setProductId]=useState("");
  const[useId,setUseId]=useState("");
  const[dose,setDose]=useState("");
  const[catalog,setCatalog]=useState<CatalogItem[]>([]);
  const[products,setProducts]=useState<Product[]>([]);
  const[uses,setUses]=useState<Use[]>([]);
  const[ingredients,setIngredients]=useState<Ingredient[]>([]);

  const country:CountryCode=fields.find(f=>f.id===fieldId)?.countryCode||initial?.countryCode||"HU";
  const spraying=type==="spraying"||type==="plant_protection";
  const fert=type==="fertilizing";
  const inputLike=fert||spraying;

  useEffect(()=>{
    let active=true;
    setLoadingCatalog(true);
    setError("");
    setCatalog([]);
    setProducts([]);
    setUses([]);
    setIngredients([]);
    setProduct("");
    setProductId("");
    setUseId("");
    fetch(`/api/operation-catalog?country=${country}&type=${encodeURIComponent(type)}`,{cache:"no-store"})
      .then(async r=>{
        const body=await r.json() as CatalogResponse;
        if(!r.ok)throw new Error(body.error||"A katalógus betöltése sikertelen.");
        return body;
      })
      .then(body=>{
        if(!active)return;
        setCatalog(body.catalog||[]);
        setProducts(body.products||[]);
        setUses(body.uses||[]);
        setIngredients(body.ingredients||[]);
      })
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"A katalógus betöltése sikertelen.")})
      .finally(()=>{if(active)setLoadingCatalog(false)});
    return()=>{active=false};
  },[country,type]);

  const productUses=useMemo(()=>uses.filter(x=>x.product_id===productId),[uses,productId]);
  const selectedUse=useMemo(()=>productUses.find(x=>x.id===useId),[productUses,useId]);
  const selectedProduct=useMemo(()=>products.find(x=>x.id===productId),[products,productId]);
  const activeIngredient=useMemo(()=>ingredients.filter(x=>x.product_id===productId).map(x=>{
    const amount=x.concentration==null?"":` ${x.concentration}${x.concentration_unit?` ${x.concentration_unit}`:""}`;
    return `${x.ingredient}${amount}`;
  }).join(", "),[ingredients,productId]);
  const fallbackFertilizers=catalog.length?catalog.map(x=>x.name):fertilizerCatalog.map(x=>x.name);
  const fallbackSoilWork=catalog.length?catalog.map(x=>x.name):soilWork;
  const summary=useMemo(()=>nutrientSummary(product,Number(dose.replace(",","."))||null),[product,dose]);

  async function submit(formData:FormData){
    setBusy(true);
    setError("");
    try{
      await createFieldOperation(formData);
      window.location.reload();
    }catch(e){
      setError(e instanceof Error?e.message:"A művelet mentése sikertelen.");
      setBusy(false);
    }
  }

  return <form action={submit} className="admin-form operation-form">
    <label>Földtábla
      <select name="field_id" value={fieldId} onChange={e=>setFieldId(e.target.value)} required>
        <option value="">Válassz földtáblát</option>
        {fields.map(f=><option key={f.id} value={f.id}>{f.name} – {f.farmName}{f.areaHa?` (${f.areaHa} ha)`:""}</option>)}
      </select>
    </label>

    <label>Dátum<input type="date" name="operation_date" defaultValue={new Date().toISOString().slice(0,10)} required/></label>

    <label>Engedélyezési ország
      <div style={{minHeight:46,display:"flex",alignItems:"center",padding:"0 12px",border:"1px solid #dce5dc",borderRadius:10,background:"#f7faf7",fontWeight:700}}>
        {country==="HU"?"🇭🇺 Magyarország":"🇸🇰 Szlovákia"}
      </div>
      <small>A kiválasztott gazdaság alapján automatikus, szerveroldalon is ellenőrzött.</small>
    </label>

    <label>Művelet
      <select name="operation_type" value={type} onChange={e=>setType(e.target.value)}>
        {operationTypes.map(([key,label])=><option value={key} key={key}>{label}</option>)}
      </select>
    </label>

    {type==="soil_work"&&<label>Munkafolyamat
      <select name="subtype" defaultValue="">
        <option value="">Válassz talajmunkát</option>
        {fallbackSoilWork.map(x=><option key={x}>{x}</option>)}
        <option value="Egyéb">Egyéb / saját művelet</option>
      </select>
    </label>}

    {fert?<label>Műtrágya / anyag
      <select name="product" value={product} onChange={e=>setProduct(e.target.value)}>
        <option value="">Válassz műtrágyát</option>
        {fallbackFertilizers.map(x=><option key={x}>{x}</option>)}
        <option value="Egyéb">Egyéb / saját termék</option>
      </select>
    </label>:spraying?<>
      <label>Készítmény / szer
        <select name="product_id" value={productId} onChange={e=>{setProductId(e.target.value);setUseId("");setProduct(products.find(x=>x.id===e.target.value)?.name||"")}} disabled={loadingCatalog}>
          <option value="">{loadingCatalog?"Katalógus betöltése…":products.length?"Válassz engedélyezett készítményt":"Nincs betöltött hivatalos készítmény"}</option>
          {products.map(x=><option key={x.id} value={x.id}>{x.name}{x.authorization_number?` – ${x.authorization_number}`:""}</option>)}
        </select>
        <input type="hidden" name="product" value={product}/>
        {!products.length&&!loadingCatalog&&<small>Az ország hivatalos készítménykatalógusa még nincs feltöltve; ideiglenesen kézi rögzítés használható.</small>}
      </label>
      {!products.length&&!loadingCatalog&&<label>Készítmény kézi megnevezése<input name="product" value={product} onChange={e=>setProduct(e.target.value)} placeholder={`${country} készítmény neve`}/></label>}
      {productId&&<label>Kultúra / engedélyezett felhasználás
        <select name="use_id" value={useId} onChange={e=>{
          const next=e.target.value;
          setUseId(next);
          const u=productUses.find(x=>x.id===next);
          if(u?.dose_unit&&u.dose_min!=null&&u.dose_max!=null&&u.dose_min===u.dose_max)setDose(String(u.dose_min).replace(".",","));
        }}>
          <option value="">Válassz kultúrát / felhasználást</option>
          {productUses.map(u=><option key={u.id} value={u.id}>{u.crop}{u.target?` – ${u.target}`:""}{u.dose_min!=null||u.dose_max!=null?` (${u.dose_min??"?"}–${u.dose_max??"?"} ${u.dose_unit||""})`:""}</option>)}
        </select>
      </label>}
      {!productId&&<label>Kultúra<input name="crop" placeholder="pl. őszi búza"/></label>}
      {!productId&&<label>Célkárosító / cél<input name="target" placeholder="pl. lisztharmat, gyomfaj"/></label>}
      <label>Hatóanyag(ok)<input name="active_ingredient" value={activeIngredient} readOnly={!!productId} placeholder="hatóanyag és koncentráció"/></label>
    </>:type!=="soil_work"&&<label>{type==="sowing"?"Vetőmag / fajta":"Anyag / megnevezés"}<input name="product" value={product} onChange={e=>setProduct(e.target.value)} placeholder="opcionális"/></label>}

    {inputLike&&<>
      <label>Dózis
        <input name="dose" value={dose} onChange={e=>setDose(e.target.value)} inputMode="decimal" placeholder="pl. 2,5"/>
        {fert&&summary&&<small>Hatóanyag kijuttatás: {summary}</small>}
        {spraying&&selectedUse&&(selectedUse.dose_min!=null||selectedUse.dose_max!=null)&&<small>Engedélyezett tartomány: {selectedUse.dose_min??"?"}–{selectedUse.dose_max??"?"} {selectedUse.dose_unit||""}</small>}
      </label>
      <label>Dózis egysége
        <select name="dose_unit" value={selectedUse?.dose_unit||undefined} defaultValue={spraying?"l/ha":"kg/ha"}>
          {selectedUse?.dose_unit&&<option>{selectedUse.dose_unit}</option>}
          <option>l/ha</option><option>kg/ha</option><option>g/ha</option><option>ml/ha</option><option>kg</option><option>l</option>
        </select>
      </label>
    </>}

    <label>Kezelt terület (ha)<input name="treated_area" inputMode="decimal" placeholder="pl. 4,2"/></label>
    <label>Összes mennyiség<input name="quantity" inputMode="decimal" placeholder="opcionális"/></label>
    <label>Mennyiség egysége<select name="quantity_unit" defaultValue="l"><option>l</option><option>kg</option><option>g</option><option>db</option><option>m³</option><option>t</option></select></label>
    <label>Gép / eszköz<input name="machine" placeholder="pl. permetezőgép"/></label>
    <label>Végrehajtó<input name="operator" placeholder="név vagy vállalkozó"/></label>
    <label className="operation-wide">Időjárás / körülmények<input name="weather" placeholder="pl. 19 °C, gyenge szél, száraz levélzet"/></label>
    <label className="operation-wide">Megjegyzés<textarea name="notes" rows={3} placeholder="Minden további szakmai megjegyzés..."/></label>

    {spraying&&<div className="operation-wide" style={{padding:12,border:"1px solid #dce5dc",borderRadius:12,fontSize:13}}>
      <b>{country==="HU"?"🇭🇺 Magyar":"🇸🇰 Szlovák"} növényvédelmi kör</b><br/>
      {selectedProduct?<>Kiválasztva: <b>{selectedProduct.name}</b>{selectedProduct.authorization_number?` · engedély: ${selectedProduct.authorization_number}`:""}. </>:null}
      {selectedUse?<>Kultúra: <b>{selectedUse.crop}</b>{selectedUse.target?` · cél: ${selectedUse.target}`:""}{selectedUse.phi_days!=null?` · ÉVI: ${selectedUse.phi_days} nap`:""}.</>:"A hivatalos felhasználás kiválasztásakor a dózist a rendszer mentéskor is ellenőrzi."}
    </div>}

    {error&&<div className="error-box operation-wide">{error}</div>}
    <button className="btn btn-primary" type="submit" disabled={busy||loadingCatalog}>{busy?"Mentés…":loadingCatalog?"Katalógus betöltése…":"Művelet rögzítése"}</button>
  </form>;
}
