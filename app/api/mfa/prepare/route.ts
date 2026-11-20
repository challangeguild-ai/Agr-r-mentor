import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function POST(){
 const supabase=await createClient();const{data:{user},error:userError}=await supabase.auth.getUser();
 if(userError||!user)return NextResponse.json({error:"Nincs érvényes munkamenet."},{status:401});
 const{data,error}=await supabase.auth.mfa.listFactors();
 if(error||!data)return NextResponse.json({error:"A kétfaktoros állapot nem ellenőrizhető."},{status:500});
 const verified=data.totp?.find(f=>f.status==="verified");if(verified)return NextResponse.json({mode:"challenge",factorId:verified.id});
 return NextResponse.json({mode:"setup"});
}
