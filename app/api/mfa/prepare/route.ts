import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function POST(){
 const supabase=await createClient();const{data:{user},error:userError}=await supabase.auth.getUser();
 if(userError||!user)return NextResponse.json({error:"Nincs érvényes munkamenet."},{status:401});
 const{data,error}=await supabase.auth.mfa.listFactors();
 if(error||!data)return NextResponse.json({error:"A kétfaktoros állapot nem ellenőrizhető."},{status:500});
 const verified=data.totp?.find(f=>f.status==="verified");if(verified)return NextResponse.json({mode:"challenge",factorId:verified.id});
 for(const factor of data.totp?.filter(f=>f.status==="unverified")??[]){const{error:deleteError}=await supabase.auth.mfa.unenroll({factorId:factor.id});if(deleteError)return NextResponse.json({error:"A félbehagyott kétfaktoros beállítás nem törölhető."},{status:500})}
 return NextResponse.json({mode:"setup"});
}
