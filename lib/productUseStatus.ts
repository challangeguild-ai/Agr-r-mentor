export type ProductUseStatus={
 country:"HU"|"SK";
 operationDate:string;
 active?:boolean|null;
 validFrom?:string|null;
 validUntil?:string|null;
 regulatoryStatus?:string|null;
 gracePeriodUntil?:string|null;
};

/**
 * Match the dated Hungarian regulatory guard in field_operations.
 * This is an early form/server-action guard, never a substitute for the
 * NÉBIH permit or the existing database trigger.
 */
export function productUseBlockingReason(p:ProductUseStatus):string|null{
 if(p.active===false)return "A kiválasztott készítmény nem aktív a hivatalos terméktörzsben.";
 const date=p.operationDate;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return "Adj meg érvényes műveleti dátumot.";
 if(p.validFrom&&date<p.validFrom)return "A készítmény engedélye ezen a napon még nem volt hatályos.";
 const status=(p.regulatoryStatus||"").toLowerCase().trim();
 const grace=p.gracePeriodUntil||"";
 if(p.country==="HU"){
  if(!status||status==="unknown")return "A készítmény magyar hatósági státusza nincs igazolva; ellenőrizd a NÉBIH engedélyokiratot.";
  if(status==="not_applicable"&&(!grace||date>grace))
   return "A készítmény a megadott műveleti napon Magyarországon nem alkalmazható.";
  if(status==="withdrawn_grace"&&(!grace||date>grace))
   return grace?`A készítmény felhasználási türelmi ideje ${grace} napján lejárt.`:"A visszavont készítmény felhasználási türelmi ideje nem igazolt.";
 }
 const withinHungarianGrace=p.country==="HU"
  &&(status==="withdrawn_grace"||status==="not_applicable")
  &&!!grace&&date<=grace;
 if(p.validUntil&&date>p.validUntil&&!withinHungarianGrace)
  return "A készítmény engedélyének időbeli hatálya lejárt a művelet napjára.";
 return null;
}
