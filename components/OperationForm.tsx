"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {createFieldOperation} from "@/app/operations/actions";
import {operationTypes} from "@/lib/operations";
import {fertilizerCatalog,soilWork,type CountryCode} from "@/lib/operationCatalog";
import {PlantProtectionUseDetails} from "@/components/PlantProtectionUseDetails";
import {parseDecimalOrNull,validDateOnly} from "@/lib/operationInput";

type FieldOption={id:string;farmId:string;name:string;farmName:string;areaHa:number|null;countryCode?:CountryCode};
type MachineOption={id:string;farmId:string;name:string;detail?:string};
type CatalogItem={id:string;name:string;category:string;metadata?:Record<string,unknown>};
type Product={id:string;name:string;authorization_number:string|null;function_type:string|null;regulatory_category:string|null;professional_use_only:boolean;prescription_required:boolean;approval_required:boolean};
type Use={id:string;product_id:string;crop:string;target:string|null;dose_min:number|null;dose_max:number|null;dose_unit:string|null;application_method:string|null;phi_days:number|null;bbch_min?:number|null;bbch_max?:number|null;max_applications?:number|null;application_interval_days?:number|null;water_volume_min?:number|null;water_volume_max?:number|null;application_timing?:string|null;restrictions?:string|null;source_reference?:string|null};
type Ingredient={product_id:string;ingredient:string;concentration:number|null;concentration_unit:string|null};
type Approver={id:string;full_name:string|null;authorization_level:"I"|"II"|"III";permit_number:string|null;valid_until:string|null;role:string|null};
type Source={source_name:string;source_url:string;status:"pending"|"ready"|"stale"|"error";last_imported_at:string|null;product_count:number;use_count:number;notes:string|null};
type CatalogResponse={catalog:CatalogItem[];products:Product[];uses:Use[];ingredients?:Ingredient[];approvers?:Approver[];source?:Source|null;error?:string};
const methodTypes=new Set(["soil_work","sowing","harvest","irrigation","mowing","other"]);
type OperationDraft={
 savedAt:number;fieldId:string;type:string;step:number;
 product:string;customProduct:string;productId:string;useId:string;catalogCrop:string;dose:string;
 doseMode:"custom"|"official_max";machineId:string;customMachine:string;entries:Record<string,string>;
};
const DRAFT_MAX_AGE=12*60*60*1000;
function decimalOrInvalid(value:string){try{return parseDecimalOrNull(value)}catch{return NaN}}

function localToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}

export function OperationForm({fields,machines=[],defaultFieldId="",draftOwnerId}:{fields:FieldOption[];machines?:MachineOption[];defaultFieldId?:string;draftOwnerId:string}){
 const formRef=useRef<HTMLFormElement>(null);
 const draftKey=`agrar-mentor:operation-draft:v1:${draftOwnerId}`;
 const draftPending=useRef<OperationDraft|null>(null);
 const draftInitialized=useRef(false);
 const draftInputsRestored=useRef(false);
 const [draftLoaded,setDraftLoaded]=useState(false);
 const [draftNotice,setDraftNotice]=useState(false);
 const [review,setReview]=useState<Record<string,string>>({});
 const initial=fields.find(f=>f.id===defaultFieldId);const[busy,setBusy]=useState(false),[loadingCatalog,setLoadingCatalog]=useState(false),[catalogLoadError,setCatalogLoadError]=useState(""),[catalogRetry,setCatalogRetry]=useState(0),[error,setError]=useState(""),[step,setStep]=useState(0);
 const[type,setType]=useState("spraying"),[fieldId,setFieldId]=useState(defaultFieldId),[product,setProduct]=useState(""),[customProduct,setCustomProduct]=useState(""),[productId,setProductId]=useState(""),[useId,setUseId]=useState(""),[catalogCrop,setCatalogCrop]=useState(""),[dose,setDose]=useState(""),[doseMode,setDoseMode]=useState<"official_max"|"custom">("custom"),[machineId,setMachineId]=useState(""),[customMachine,setCustomMachine]=useState("");
 const[catalog,setCatalog]=useState<CatalogItem[]>([]),[products,setProducts]=useState<Product[]>([]),[uses,setUses]=useState<Use[]>([]),[ingredients,setIngredients]=useState<Ingredient[]>([]),[approvers,setApprovers]=useState<Approver[]>([]),[source,setSource]=useState<Source|null>(null);
 const selectedField=fields.find(f=>f.id===fieldId)||initial,country:CountryCode=selectedField?.countryCode||"HU",farmId=selectedField?.farmId||"",spraying=type==="spraying"||type==="plant_protection",fert=type==="fertilizing",inputLike=fert||spraying,hasMethod=methodTypes.has(type);
 useEffect(()=>{let active=true;setLoadingCatalog(true);setCatalogLoadError("");setError("");setCatalog([]);setProducts([]);setUses([]);setIngredients([]);setApprovers([]);setSource(null);setProduct("");setCustomProduct("");setProductId("");setUseId("");setCatalogCrop("");setDose("");setDoseMode("custom");fetch(`/api/operation-catalog?country=${country}&type=${encodeURIComponent(type)}${farmId?`&farm=${encodeURIComponent(farmId)}`:""}`,{cache:"no-store"}).then(async r=>{const body=await r.json() as CatalogResponse;if(!r.ok)throw new Error(body.error||"A katalógus betöltése sikertelen.");return body}).then(body=>{if(!active)return;setCatalog(body.catalog||[]);setProducts(body.products||[]);setUses(body.uses||[]);setIngredients(body.ingredients||[]);setApprovers(body.approvers||[]);setSource(body.source||null);
  const draft=draftPending.current;
  if(draft&&draft.type===type&&draft.fieldId===fieldId){
   const validProduct=body.products?.some(p=>p.id===draft.productId);
   const validUse=body.uses?.some(u=>u.id===draft.useId&&u.product_id===draft.productId);
   setProduct(draft.product||"");setCustomProduct(draft.customProduct||"");
   setProductId(validProduct?draft.productId:"");setUseId(validUse?draft.useId:"");
   setCatalogCrop(draft.catalogCrop||"");setDose(draft.dose||"");
   setDoseMode(draft.doseMode==="official_max"?"official_max":"custom");
   setMachineId(draft.machineId||"");setCustomMachine(draft.customMachine||"");
   setDraftLoaded(true);
  }
 }).catch(e=>{if(active){const message=e instanceof Error?e.message:"A katalógus betöltése sikertelen.";setCatalogLoadError(message);setError(message);if(draftPending.current)setDraftLoaded(true)}}).finally(()=>{if(active)setLoadingCatalog(false)});return()=>{active=false}},[country,type,farmId,catalogRetry]);
 useEffect(()=>{setMachineId("");setCustomMachine("")},[fieldId]);
 // Restore only this user's short-lived, tab-local draft. No database write happens here.
 useEffect(()=>{
  if(draftInitialized.current)return;
  draftInitialized.current=true;
  try{
   const raw=sessionStorage.getItem(draftKey);
   if(raw){
    const saved=JSON.parse(raw) as OperationDraft;
    if(!saved||!Number.isFinite(saved.savedAt)||Date.now()-saved.savedAt>DRAFT_MAX_AGE
       ||!fields.some(f=>f.id===saved.fieldId)
       ||(defaultFieldId&&defaultFieldId!==saved.fieldId)){
      if(!defaultFieldId||defaultFieldId===saved?.fieldId)sessionStorage.removeItem(draftKey);
    }else{
     draftPending.current=saved;
     setFieldId(saved.fieldId);setType(saved.type);
     setStep(Math.max(0,Math.min(3,Number(saved.step)||0)));
     setReview(saved.entries||{});
     setDraftNotice(true);
    }
   }
  }catch{try{sessionStorage.removeItem(draftKey)}catch{}}
  if(!draftPending.current)setDraftLoaded(true);
  // Stored drafts are deliberately scoped to the signed-in user, not the farm alone.
 },[draftKey,defaultFieldId,fields]);
 // Apply values to uncontrolled controls after the relevant catalog has loaded.
 useEffect(()=>{
  if(!draftLoaded||draftInputsRestored.current)return;
  const saved=draftPending.current;
  if(!saved){draftInputsRestored.current=true;return}
  if(loadingCatalog)return;
  const names=new Set(["operation_date","subtype","crop","target","active_ingredient","dose_unit",
   "treated_area","quantity","quantity_unit","operator","weather","notes","requested_approver_id"]);
  for(const el of formRef.current?.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("[name]")||[]){
   if(names.has(el.name)&&Object.prototype.hasOwnProperty.call(saved.entries||{},el.name)){
    const value=saved.entries[el.name];
    if(el instanceof HTMLSelectElement){
     if(Array.from(el.options).some(o=>o.value===value))el.value=value;
    }else if(!el.readOnly)el.value=value;
   }
  }
  draftInputsRestored.current=true;
  draftPending.current=null;
 },[draftLoaded,loadingCatalog]);
 function persistDraft(){
  if(!draftLoaded||busy||!formRef.current)return;
  try{
   const entries:Record<string,string>={};
   for(const [k,v] of new FormData(formRef.current).entries())if(typeof v==="string")entries[k]=v;
   const saved:OperationDraft={savedAt:Date.now(),fieldId,type,step,product,customProduct,productId,useId,
    catalogCrop,dose,doseMode,machineId,customMachine,entries};
   sessionStorage.setItem(draftKey,JSON.stringify(saved));
  }catch{/* Private mode/storage restrictions must not prevent entering a record. */}
 }
 useEffect(()=>{persistDraft()},[draftLoaded,fieldId,type,step,product,customProduct,productId,useId,catalogCrop,dose,doseMode,machineId,customMachine]);
 const hasUseCatalog=uses.length>0;
 const cropOptions=useMemo(()=>Array.from(new Set(uses.map(x=>x.crop).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"hu")),[uses]);
 const filteredProducts=useMemo(()=>!hasUseCatalog||!catalogCrop?products:products.filter(p=>uses.some(u=>u.product_id===p.id&&u.crop===catalogCrop)),[products,uses,catalogCrop,hasUseCatalog]);
 const productUses=useMemo(()=>uses.filter(x=>x.product_id===productId&&(!catalogCrop||x.crop===catalogCrop)),[uses,productId,catalogCrop]),selectedUse=useMemo(()=>productUses.find(x=>x.id===useId),[productUses,useId]),selectedProduct=useMemo(()=>products.find(x=>x.id===productId),[products,productId]);
 const activeIngredient=useMemo(()=>ingredients.filter(x=>x.product_id===productId).map(x=>`${x.ingredient}${x.concentration==null?"":` ${x.concentration}${x.concentration_unit?` ${x.concentration_unit}`:""}`}`).join(", "),[ingredients,productId]);
 const normalizedCategory=(selectedProduct?.regulatory_category||"").toUpperCase().replace(".","").trim();
 const approvalNeeded=!!selectedProduct&&hasUseCatalog&&(selectedProduct.approval_required||selectedProduct.professional_use_only||selectedProduct.prescription_required||(country==="HU"&&(normalizedCategory==="I"||normalizedCategory==="II")));
 const eligibleApprovers=useMemo(()=>approvers.filter(a=>a.role!=="advisor"&&(normalizedCategory==="I"?a.authorization_level==="I":normalizedCategory==="II"?(a.authorization_level==="I"||a.authorization_level==="II"):true)),[approvers,normalizedCategory]);
 const fertilizerOptions=catalog.length?catalog.map(x=>x.name):fertilizerCatalog.map(x=>x.name),methodOptions=catalog.length?catalog.map(x=>x.name):(type==="soil_work"?soilWork:[]),availableMachines=machines.filter(m=>!selectedField||m.farmId===selectedField.farmId),selectedMachine=machines.find(m=>m.id===machineId),effectiveProduct=product==="Egyéb"?customProduct:product;
 const nutrientSummary=useMemo(()=>{if(!fert||!effectiveProduct)return"";const d=Number(dose.replace(",","."));if(!Number.isFinite(d)||d<=0)return"";const item=catalog.find(x=>x.name===effectiveProduct)||fertilizerCatalog.find(x=>x.name===effectiveProduct);const meta=item?.metadata||{};return Object.entries(meta).filter(([,v])=>typeof v==="number").map(([k,v])=>`${k}: ${Math.round(d*(v as number))/100} kg/ha`).join(" · ")},[fert,effectiveProduct,dose,catalog]);
 function chooseUse(next:string){setUseId(next);const u=productUses.find(x=>x.id===next);if(u?.dose_max!=null){setDoseMode("official_max");setDose(String(u.dose_max).replace(".",","))}else{setDoseMode("custom");setDose("")}}
 function chooseDoseMode(mode:"official_max"|"custom"){setDoseMode(mode);if(mode==="official_max"&&selectedUse?.dose_max!=null)setDose(String(selectedUse.dose_max).replace(".",","));else setDose("")}
 function validateStep(targetStep:number,formData:FormData):string|null{
  if(targetStep===0){
   if(!fieldId||!fields.some(f=>f.id===fieldId))return "Az alapadatoknál válassz érvényes földtáblát.";
   const date=String(formData.get("operation_date")||"");
   if(!validDateOnly(date))return "Adj meg érvényes műveleti dátumot.";
   if(!operationTypes.some(([key])=>key===type))return "Válassz érvényes művelettípust.";
  }
  if(targetStep===1){
   if(loadingCatalog)return "A szakmai katalógus még töltődik.";
   if(spraying&&catalogLoadError)return "Növényvédelmi művelet nem rögzíthető, amíg a hivatalos katalógus betöltése hibás. Próbáld újra a betöltést.";
   if(fert&&!effectiveProduct.trim())return "Válassz vagy adj meg műtrágyát / anyagot.";
   if(spraying){
    if(products.length&&!productId)return "Válassz hivatalos készítményt.";
    if(!products.length&&!product.trim())return "Add meg a készítmény nevét.";
    if(products.length&&!hasUseCatalog)return "Ehhez a katalógusbeli készítményhez nincs ellenőrzött felhasználási adat; hivatalos műveletként nem rögzíthető.";
    if(hasUseCatalog&&(!catalogCrop||!useId||!selectedUse))return "Válassz érvényes kultúrát és engedélyezett felhasználást.";
    if(selectedUse&&(selectedUse.dose_max!=null||selectedUse.dose_min!=null)){
     const n=decimalOrInvalid(dose);
     if(n===null||!Number.isFinite(n))return "Adj meg érvényes dózist.";
     if((selectedUse.dose_min!=null&&n<selectedUse.dose_min)||(selectedUse.dose_max!=null&&n>selectedUse.dose_max))
       return "A dózisnak a hivatalosan engedélyezett tartományba kell esnie.";
    }
    if(approvalNeeded&&!eligibleApprovers.length)return "Ehhez a készítményhez előbb rögzíts megfelelő gazdasági jóváhagyót.";
    if(approvalNeeded&&!String(formData.get("requested_approver_id")||""))return "Válassz gazdasági jóváhagyó személyt.";
   }
   const enteredDose=String(formData.get("dose")||"").trim();
   if(enteredDose&&((!Number.isFinite(decimalOrInvalid(enteredDose)))||(decimalOrInvalid(enteredDose)??0)<0))return "A dózis érvénytelen: nemnegatív számot adj meg.";
  }
  if(targetStep===2){
   const area=String(formData.get("treated_area")||"").trim().replace(",",".");
   if(area){const n=decimalOrInvalid(area);if(n===null||!Number.isFinite(n)||n<=0||(selectedField?.areaHa!=null&&n>selectedField.areaHa))return "A kezelt terület pozitív szám legyen, és nem haladhatja meg a földtábla méretét.";}
   const quantity=String(formData.get("quantity")||"").trim().replace(",",".");
   if(quantity&&(!Number.isFinite(decimalOrInvalid(quantity))||(decimalOrInvalid(quantity)??0)<0))return "Az összes mennyiség nem lehet negatív vagy érvénytelen.";
   if(machineId==="manual"&&!customMachine.trim())return "Add meg a külső gép megnevezését.";
  }
  return null;
 }
 function advance(){
  const formData=new FormData(formRef.current!);
  const message=validateStep(step,formData);
  if(message){setError(message);formRef.current?.scrollIntoView({behavior:"smooth",block:"start"});return}
  if(step===2){
   const entries:Record<string,string>={};
   for(const [key,value] of formData.entries())if(typeof value==="string")entries[key]=value;
   setReview(entries);
  }
  setError("");setStep(v=>Math.min(3,v+1));
 }
 async function submit(formData:FormData){
  for(let s=0;s<3;s++){const message=validateStep(s,formData);if(message){setStep(s);setError(message);return}}
  setBusy(true);setError("");
  try{await createFieldOperation(formData);try{sessionStorage.removeItem(draftKey)}catch{}window.location.reload()}
  catch(e){setError(e instanceof Error?e.message:"A művelet mentése sikertelen.");setBusy(false)}
 }
 return <form ref={formRef} noValidate action={submit} onInput={persistDraft} onChange={persistDraft} className="admin-form operation-form am-wizard" data-tour="farmer-operation-wizard">
  <div className="operation-wide am-wizard-progress am-wizard-progress-labeled"><span className={step>=0?"active":""}>Alapadatok</span><i/><span className={step>=1?"active":""}>Szakmai részletek</span><i/><span className={step>=2?"active":""}>Végrehajtás</span><i/><span className={step>=3?"active":""}>Ellenőrzés</span></div>
  <div className="operation-wide am-operation-step-head"><span className="eyebrow">MŰVELET RÖGZÍTÉSE</span><h3>{step===0?"Alapadatok":step===1?"Anyag és szakmai részletek":step===2?"Végrehajtás":"Ellenőrzés és mentés"}</h3></div>
  {draftNotice&&<div className="operation-wide am-draft-notice" role="status">
    Korábbi, ezen a böngészőlapon mentett kitöltés visszaállítva. Ellenőrizd újra a hivatalos készítményadatokat.
    <button type="button" onClick={()=>{try{sessionStorage.removeItem(draftKey)}catch{}window.location.reload()}}>Piszkozat elvetése</button>
   </div>}
  {error&&<div className="error-box operation-wide" role="alert">{error}</div>}
  {catalogLoadError&&<div className="operation-wide am-draft-notice" role="status">
    <span>A szakmai katalógus betöltése sikertelen. Növényvédelmi rögzítéshez előbb helyre kell állnia az adatkapcsolatnak.</span>
    <button type="button" disabled={loadingCatalog} onClick={()=>setCatalogRetry(v=>v+1)}>Katalógus újratöltése</button>
   </div>}
  <div className="operation-wide am-operation-step" style={{display:step===0?"contents":"none"}}>
  <label>Földtábla<select name="field_id" value={fieldId} onChange={e=>setFieldId(e.target.value)} required><option value="">Válassz földtáblát</option>{fields.map(f=><option key={f.id} value={f.id}>{f.name} – {f.farmName}{f.areaHa?` (${f.areaHa} ha)`:""}</option>)}</select></label>
  <label>Dátum<input type="date" name="operation_date" defaultValue={localToday()} required/></label>
  <label>Engedélyezési ország<div style={{minHeight:46,display:"flex",alignItems:"center",padding:"0 12px",border:"1px solid #dce5dc",borderRadius:10,background:"#f7faf7",fontWeight:700}}>{country==="HU"?"🇭🇺 Magyarország":"🇸🇰 Szlovákia"}</div></label>
  <label>Művelet<select name="operation_type" value={type} onChange={e=>setType(e.target.value)}>{operationTypes.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
  {hasMethod&&<label>Munkafolyamat<select name="subtype" defaultValue="" key={type}><option value="">Válassz munkafolyamatot</option>{methodOptions.map(x=><option key={x}>{x}</option>)}<option value="Egyéb">Egyéb / saját művelet</option></select></label>}
  </div>
  <div className="operation-wide am-operation-step" style={{display:step===1?"contents":"none"}}>
  {fert?<><label>Műtrágya / anyag<select value={product} onChange={e=>{setProduct(e.target.value);setCustomProduct("")}}><option value="">Válassz műtrágyát</option>{fertilizerOptions.map(x=><option key={x}>{x}</option>)}<option value="Egyéb">Egyéb / saját termék</option></select><input type="hidden" name="product" value={effectiveProduct}/></label>{product==="Egyéb"&&<label>Saját termék megnevezése<input value={customProduct} onChange={e=>setCustomProduct(e.target.value)} required/></label>}</>:spraying?<>
   {products.length>0&&hasUseCatalog&&<label>Kultúra<select value={catalogCrop} onChange={e=>{setCatalogCrop(e.target.value);setProductId("");setUseId("");setProduct("");setDose("")}} required><option value="">Válassz kultúrát</option>{cropOptions.map(c=><option key={c}>{c}</option>)}</select></label>}
   <label>Készítmény / szer<select name={hasUseCatalog?"product_id":undefined} value={productId} onChange={e=>{const id=e.target.value;setProductId(id);setUseId("");setDose("");setProduct(products.find(x=>x.id===id)?.name||"")}} disabled={loadingCatalog||(products.length>0&&hasUseCatalog&&!catalogCrop)} required={products.length>0}><option value="">{loadingCatalog?"Katalógus betöltése…":products.length?(hasUseCatalog?(catalogCrop?"Válassz engedélyezett készítményt":"Előbb válassz kultúrát"):"Válassz hivatalos terméktörzsből"):"Nincs betöltött hivatalos készítmény"}</option>{filteredProducts.map(x=><option key={x.id} value={x.id}>{x.name}{x.regulatory_category?` · ${x.regulatory_category}. kategória`:""}{x.authorization_number?` · ${x.authorization_number}`:""}</option>)}</select>{products.length?<input type="hidden" name="product" value={product}/>:null}</label>
   {!products.length&&!loadingCatalog&&<label>Készítmény kézi megnevezése<input name="product" value={product} onChange={e=>setProduct(e.target.value)} placeholder={`${country} készítmény neve`}/></label>}
   {productId&&productUses.length>0&&<label>Engedélyezett felhasználás / cél<select name="use_id" value={useId} onChange={e=>chooseUse(e.target.value)} required><option value="">Válassz engedélyezett felhasználást</option>{productUses.map(u=><option key={u.id} value={u.id}>{u.target||u.application_method||u.crop}{u.dose_min!=null||u.dose_max!=null?` (${u.dose_min??"?"}–${u.dose_max??"?"} ${u.dose_unit||""})`:""}{country==="SK"&&u.bbch_min!=null?` · BBCH ${u.bbch_min}${u.bbch_max!=null?`–${u.bbch_max}`:""}`:""}</option>)}</select></label>}
   {((!products.length&&!loadingCatalog)||(productId&&!hasUseCatalog))&&<><label>Kultúra<input name="crop" required={!!productId} placeholder="A ténylegesen kezelt kultúra"/></label><label>Célkárosító / cél<input name="target" placeholder="Gyom, kártevő, betegség vagy egyéb cél"/></label></>}
   <label>Hatóanyag(ok){productId?<input name="active_ingredient" value={activeIngredient} readOnly/>:<input name="active_ingredient"/>}</label>
   {selectedUse&&<PlantProtectionUseDetails use={selectedUse} country={country}/>} 
  </>:type==="sowing"?<label>Vetőmag / fajta<input name="product" value={product} onChange={e=>setProduct(e.target.value)}/></label>:null}
  {inputLike&&<>{spraying&&selectedUse?.dose_max!=null?<><label>Dózis választása<select name="dose_mode" value={doseMode} onChange={e=>chooseDoseMode(e.target.value as "official_max"|"custom")}><option value="official_max">Hivatalos maximális dózis: {selectedUse.dose_max} {selectedUse.dose_unit||""}</option><option value="custom">Egyéni dózis</option></select><small>Az egyéni dózis nem lehet nagyobb a hivatalos maximumnál.</small></label>{doseMode==="custom"&&<label>Egyéni dózis<input name="dose" value={dose} onChange={e=>setDose(e.target.value)} inputMode="decimal" min={selectedUse.dose_min??undefined} max={selectedUse.dose_max} required/><small>Engedélyezett tartomány: {selectedUse.dose_min??0}–{selectedUse.dose_max} {selectedUse.dose_unit||""}</small></label>}{doseMode==="official_max"&&<input type="hidden" name="dose" value={selectedUse.dose_max}/>}</>:<label>Dózis<input name="dose" value={dose} onChange={e=>setDose(e.target.value)} inputMode="decimal"/></label>}<label>Dózis egysége{selectedUse?.dose_unit?<><select value={selectedUse.dose_unit} disabled><option>{selectedUse.dose_unit}</option></select><input type="hidden" name="dose_unit" value={selectedUse.dose_unit}/></>:<select name="dose_unit" defaultValue={spraying?"l/ha":"kg/ha"}><option>l/ha</option><option>kg/ha</option><option>g/ha</option><option>ml/ha</option><option>kg</option><option>l</option></select>}</label></>}
  {approvalNeeded&&<div className="operation-wide" style={{padding:14,border:"1px solid #e1b95d",borderRadius:12,background:"#fffaf0"}}><b>⚠ Jogosultsághoz kötött készítmény</b><p style={{margin:"6px 0 10px"}}>A szaktanácsadó javaslata nem jelent kijuttatási jóváhagyást. A gazdaságnak saját, érvényes növényvédelmi jogosultsággal rendelkező személyt kell kijelölnie.</p>{eligibleApprovers.length?<label>Gazdasági jóváhagyó személy<select name="requested_approver_id" required><option value="">Válassz a gazdaság jogosult személyei közül</option>{eligibleApprovers.map(a=><option key={a.id} value={a.id}>{a.full_name||"Jogosult személy"} · {a.authorization_level}. kategória{a.permit_number?` · ${a.permit_number}`:""}{a.valid_until?` · érvényes: ${a.valid_until}`:""}</option>)}</select></label>:<div className="error-box">Ehhez a készítményhez nincs megfelelő, aktív jogosultságú személy beállítva a gazdaságnál. Előbb a Gazdaságom oldalon adj meg növényvédelmi jóváhagyót.</div>}</div>}
  </div>
  <div className="operation-wide am-operation-step" style={{display:step===2?"contents":"none"}}>
  <label>Kezelt terület (ha)<input name="treated_area" inputMode="decimal"/></label><label>Összes mennyiség<input name="quantity" inputMode="decimal"/></label><label>Mennyiség egysége<select name="quantity_unit" defaultValue="l"><option>l</option><option>kg</option><option>g</option><option>db</option><option>m³</option><option>t</option></select></label>
  <label>Gép / eszköz<select name="machine_id" value={machineId} onChange={e=>{setMachineId(e.target.value);setCustomMachine("")}}><option value="">Nincs kiválasztott gép</option>{availableMachines.map(m=><option key={m.id} value={m.id}>{m.name}{m.detail?` – ${m.detail}`:""}</option>)}<option value="manual">Egyéb / külső gép</option></select><input type="hidden" name="machine" value={machineId==="manual"?customMachine:selectedMachine?.name||""}/></label>{machineId==="manual"&&<label>Gép kézi megnevezése<input value={customMachine} onChange={e=>setCustomMachine(e.target.value)} required/></label>}
  <label>Végrehajtó<input name="operator"/></label><label className="operation-wide">Időjárás / körülmények<input name="weather"/></label><label className="operation-wide">Megjegyzés<textarea name="notes" rows={3}/></label>
  </div>
  <div className="operation-wide am-operation-step" style={{display:step===3?"contents":"none"}}>
  <div className="operation-wide am-wizard-summary">
    <div><small>Földtábla</small><strong>{selectedField?.name||"—"}</strong></div>
    <div><small>Művelet</small><strong>{operationTypes.find(([k])=>k===type)?.[1]||type}</strong></div>
    <div><small>Anyag / készítmény</small><strong>{effectiveProduct||"Nincs megadva"}</strong></div>
    <div><small>Gép</small><strong>{machineId==="manual"?customMachine:selectedMachine?.name||"Nincs kiválasztva"}</strong></div>
    <div><small>Művelet dátuma</small><strong>{review.operation_date||"—"}</strong></div>
    <div><small>Kezelt terület</small><strong>{review.treated_area?`${review.treated_area} ha`:"Nincs megadva"}</strong></div>
    {inputLike&&<div><small>Dózis</small><strong>{dose?`${dose} ${selectedUse?.dose_unit||review.dose_unit||""}`:"Nincs megadva"}</strong></div>}
    <div><small>Mennyiség</small><strong>{review.quantity?`${review.quantity} ${review.quantity_unit||""}`:"Nincs megadva"}</strong></div>
    <div><small>Végrehajtó</small><strong>{review.operator||"Nincs megadva"}</strong></div>
    <div><small>Időjárási körülmények</small><strong>{review.weather||"Nincs megadva"}</strong></div>
  </div>
  {spraying&&<div className="operation-wide" style={{padding:12,border:"1px solid #dce5dc",borderRadius:12,fontSize:13}}><b>{country==="HU"?"🇭🇺 Magyar":"🇸🇰 Szlovák"} növényvédelmi kör</b><br/>{selectedProduct?<>Kiválasztva: <b>{selectedProduct.name}</b>{selectedProduct.regulatory_category?` · ${selectedProduct.regulatory_category}. forgalmi kategória`:""}{selectedProduct.authorization_number?` · engedély: ${selectedProduct.authorization_number}`:""}. </>:null}{selectedUse?<>Kultúra: <b>{selectedUse.crop}</b>{selectedUse.target?` · cél: ${selectedUse.target}`:""}{selectedUse.phi_days!=null?` · ÉVI: ${selectedUse.phi_days} nap`:""}{country==="SK"&&selectedUse.bbch_min!=null?` · BBCH ${selectedUse.bbch_min}${selectedUse.bbch_max!=null?`–${selectedUse.bbch_max}`:""}`:""}.</>:selectedProduct&&!hasUseCatalog?"A készítmény hivatalos terméktörzsből származik, de a nyilvános forrás nem adott hozzá ellenőrzött kultúra–cél–dózis rekordot. A megadott felhasználást a hatályos engedélyokirat alapján kell ellenőrizni; a rendszer ilyen esetben nem jelöl dózist hivatalosként.":source?.status==="ready"?"Az engedélyezett felhasználás kiválasztása kötelező.":"A hivatalos katalógus importja még nem teljes."}</div>}
  {fert&&nutrientSummary&&<div className="operation-wide"><small>Hatóanyag kijuttatás: {nutrientSummary}</small></div>}
  </div>
  <div className="operation-wide am-wizard-actions">{step>0&&<button className="ghost-btn" type="button" onClick={()=>setStep(v=>Math.max(0,v-1))}>← Vissza</button>}<span/>{step<3?<button className="btn btn-primary" type="button" disabled={step===0&&!fieldId||loadingCatalog} onClick={advance}>Tovább →</button>:<button className="btn btn-primary" type="submit" disabled={busy||loadingCatalog||(approvalNeeded&&eligibleApprovers.length===0)}>{busy?"Mentés…":loadingCatalog?"Katalógus betöltése…":"Művelet rögzítése"}</button>}</div>
 </form>;
}
