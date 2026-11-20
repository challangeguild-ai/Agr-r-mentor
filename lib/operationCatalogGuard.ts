/** The manual HU route records a historical fact, not a permitted application. */
export function validateManualPlantProtection(input:{
 country:"HU"|"SK";hasVerifiedUses:boolean;policyReady:boolean;productId:string;useId:string;
 productName:string;crop:string;dose:number|null;doseUnit:string;acknowledged:boolean;
}):string|null{
 if(input.productId.trim())return null; // Official selection has its own strict use/dose checks.
 if(!input.policyReady)return "A kézi növényvédelmi naplózás szerveroldali védelme még nincs élesítve.";
 if(input.country!=="HU"||input.hasVerifiedUses)return "Hivatalos növényvédelmi adatok esetén kötelező engedélyezett készítményt és felhasználást választani.";
 if(input.useId.trim())return "Engedélyezett felhasználás nem adható meg hivatalos készítmény nélkül.";
 if(!input.productName.trim()||!input.crop.trim())return "Kézi naplózáshoz a tényleges készítmény és kultúra neve kötelező.";
 if(input.dose===null||!Number.isFinite(input.dose)||input.dose<=0||!input.doseUnit.trim())return "Add meg a ténylegesen kijuttatott pozitív dózist és mértékegységét.";
 if(!input.acknowledged)return "Erősítsd meg, hogy a hatályos NÉBIH engedélyokiratot külön ellenőrizted; a naplózás nem jelent engedélyt.";
 return null;
}
