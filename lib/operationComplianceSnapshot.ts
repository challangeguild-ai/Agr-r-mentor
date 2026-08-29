import {evaluatePlantProtectionCompliance,type ComplianceCheck} from "@/lib/operationCompliance";

type Snapshot=Record<string,unknown>;
type OperationSnapshotInput={country?:string|null;operationDate?:string|null;dose?:number|null;doseUnit?:string|null;approvalRequired?:boolean|null;approvalStatus?:string|null;regulatory?:Snapshot|null};
function text(v:unknown){return typeof v==="string"&&v.trim()?v.trim():null}
function number(v:unknown){if(typeof v==="number"&&Number.isFinite(v))return v;if(typeof v==="string"&&v.trim()){const n=Number(v.replace(",","."));return Number.isFinite(n)?n:null}return null}
function bool(v:unknown){return typeof v==="boolean"?v:null}
export function complianceFromOperationSnapshot(input:OperationSnapshotInput):ComplianceCheck[]{const r=input.regulatory??{};const hasUse=Boolean(text(r.crop)||text(r.target)||text(r.application_method));return evaluatePlantProtectionCompliance({country:input.country==="SK"?"SK":"HU",operationDate:input.operationDate||new Date().toISOString().slice(0,10),productActive:bool(r.product_active??r.active),validFrom:text(r.valid_from),validUntil:text(r.valid_until),regulatoryStatus:text(r.regulatory_status),gracePeriodUntil:text(r.grace_period_until),hasOfficialUse:hasUse?true:null,dose:input.dose??null,doseMin:number(r.dose_min),doseMax:number(r.dose_max),doseUnit:input.doseUnit||text(r.dose_unit),approvalRequired:Boolean(input.approvalRequired),approvalStatus:input.approvalStatus||null,sourceStatus:text(r.source_status),sourceCheckedAt:text(r.source_checked_at)});}
