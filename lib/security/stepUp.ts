import {createHmac,timingSafeEqual} from "node:crypto";

export const STEP_UP_COOKIE="am-step-up-export";
export const STEP_UP_TTL_SECONDS=300;

type Grant={userId:string;action:"export";expires:number};

function secret(){const v=process.env.SECURITY_STEPUP_SECRET;if(!v||v.length<32)throw new Error("SECURITY_STEPUP_SECRET nincs biztonságosan beállítva.");return v}
function sig(payload:string){return createHmac("sha256",secret()).update(payload).digest("base64url")}

export function issueStepUpGrant(userId:string,action:"export"="export"){const grant:Grant={userId,action,expires:Math.floor(Date.now()/1000)+STEP_UP_TTL_SECONDS};const payload=Buffer.from(JSON.stringify(grant)).toString("base64url");return `${payload}.${sig(payload)}`}

export function verifyStepUpGrant(token:string|undefined,userId:string,action:"export"="export"){if(!token)return false;const[payload,signature]=token.split(".");if(!payload||!signature)return false;const expected=sig(payload);const a=Buffer.from(signature);const b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return false;try{const grant=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as Grant;return grant.userId===userId&&grant.action===action&&Number.isFinite(grant.expires)&&grant.expires>=Math.floor(Date.now()/1000)}catch{return false}}
