/** Shared form validation for the farmer UI and the server action. */
export function validDateOnly(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(`${value}T12:00:00Z`);
 return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}

/** The authorization must remain valid today and on the scheduled date. */
export function licenseCoversDate(validUntil:string|null|undefined,scheduledDate:string,today:string):boolean{
 if(!validUntil||!validDateOnly(validUntil)||!validDateOnly(today))return false;
 if(scheduledDate&&!validDateOnly(scheduledDate))return false;
 return validUntil>=(scheduledDate>today?scheduledDate:today);
}

/** Planned areas must be positive and cannot exceed their field boundary. */
export function validatePlannedArea(area:number|null,fieldArea:number|null):string|null{
 if(area===null)return null;
 if(!Number.isFinite(area)||area<=0)return "A tervezett területnek pozitív számnak kell lennie.";
 if(fieldArea!==null&&Number.isFinite(fieldArea)&&area>fieldArea)
  return "A tervezett terület nem haladhatja meg a földtábla méretét.";
 return null;
}

/** Blank values are optional; malformed numeric values are never silently discarded. */
export function parseDecimalOrNull(input:string):number|null{
 const normalized=input.trim().replace(",",".");
 if(!normalized)return null;
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized))
  throw new Error("Érvénytelen számérték. Tizedesjegyekhez vessző vagy pont használható.");
 const value=Number(normalized);
 if(!Number.isFinite(value))throw new Error("A megadott szám túl nagy vagy érvénytelen.");
 return value;
}
