export type PesticideApprovalFlags={
 approval_required?:boolean|null;
 professional_use_only?:boolean|null;
 prescription_required?:boolean|null;
 regulatory_category?:string|null;
};
export function regulatoryCategory(value:string|null|undefined):string{
 return (value||"").trim().toUpperCase().replace(/\.$/,"");
}
/**
 * Hungarian Category I/II products always need a suitably licensed farm
 * approver. Other country classifications follow the explicit product flags.
 */
export function requiresPlantProtectionApprover(country:"HU"|"SK",flags:PesticideApprovalFlags):boolean{
 const category=regulatoryCategory(flags.regulatory_category);
 return !!(flags.approval_required||flags.professional_use_only||flags.prescription_required||
   (country==="HU"&&(category==="I"||category==="II")));
}
export function licenseAllowsCategory(level:string|null|undefined,category:string|null|undefined):boolean{
 const normalized=regulatoryCategory(category);
 if(normalized==="I")return level==="I";
 if(normalized==="II")return level==="I"||level==="II";
 return !!level;
}
