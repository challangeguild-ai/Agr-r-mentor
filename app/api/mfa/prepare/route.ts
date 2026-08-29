import {NextResponse} from "next/server";
import {createClient as createServerClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";

export async function POST(){
  const supabase=await createServerClient();
  const{data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user)return NextResponse.json({error:"Nincs érvényes munkamenet."},{status:401});

  const admin=createAdminClient();
  const{data,error}=await admin.auth.admin.mfa.listFactors({userId:user.id});
  if(error||!data)return NextResponse.json({error:"A kétfaktoros állapot nem ellenőrizhető."},{status:500});

  const verified=data.factors.find(f=>f.factor_type==="totp"&&f.status==="verified");
  if(verified)return NextResponse.json({mode:"challenge",factorId:verified.id});

  const stale=data.factors.filter(f=>f.factor_type==="totp"&&f.status==="unverified");
  for(const factor of stale){
    const{error:deleteError}=await admin.auth.admin.mfa.deleteFactor({userId:user.id,id:factor.id});
    if(deleteError)return NextResponse.json({error:"A félbehagyott kétfaktoros beállítás nem törölhető."},{status:500});
  }

  return NextResponse.json({mode:"setup"});
}
