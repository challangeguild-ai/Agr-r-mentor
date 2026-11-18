/** Shared form validation for the farmer UI and the server action. */
export function validDateOnly(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(`${value}T12:00:00Z`);
 return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
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
