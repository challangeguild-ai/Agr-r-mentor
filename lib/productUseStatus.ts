export type ProductStatusInput={
 country:"HU"|"SK"; operationDate:string; active?:boolean|null;
 validFrom?:string|null; validUntil?:string|null;
 regulatoryStatus?:string|null; gracePeriodUntil?:string|null;
};

/** Fail closed on unknown or withdrawn Hungarian authority statuses. */
export function productUseBlockingReason(p:ProductStatusInput):string|null{
 if(p.active===false)return "A készítmény nem aktív a hivatalos katalógusban.";
 if(!/^\d{4}-\d{2}-\d{2}$/.test(p.operationDate))return "Érvénytelen műveleti dátum.";
 if(p.validFrom&&p.operationDate<p.validFrom)return "A készítmény engedélye ezen a napon még nem volt hatályos.";
 const status=(p.regulatoryStatus||"").trim().toLowerCase();
 const grace=p.gracePeriodUntil||"";
 if(p.country==="HU"){
  if(!status||status==="unknown")return "A készítmény magyar hatósági státusza nincs igazolva; a NÉBIH engedélyokirata ellenőrizendő.";
  if(status==="not_applicable"&&(!grace||p.operationDate>grace))return "A készítmény ezen a napon Magyarországon nem alkalmazható.";
  if(status==="withdrawn_grace"&&(!grace||p.operationDate>grace))return "A visszavont készítmény igazolt felhasználási türelmi ideje lejárt vagy hiányzik.";
 }
 const duringGrace=p.country==="HU"&&(status==="withdrawn_grace"||status==="not_applicable")&&!!grace&&p.operationDate<=grace;
 if(p.validUntil&&p.operationDate>p.validUntil&&!duringGrace)return "A készítmény engedélye a művelet napján lejárt.";
 return null;
}
