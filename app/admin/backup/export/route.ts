import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Nincs bejelentkezve."},{status:401});
 const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(profile?.role!=="advisor")return NextResponse.json({error:"Nincs jogosultság biztonsági mentéshez."},{status:403});
 const{data,error}=await supabase.rpc("export_app_backup");
 if(error)return NextResponse.json({error:error.message},{status:500});
 const stamp=new Date().toISOString().replace(/[:.]/g,"-");
 return new NextResponse(JSON.stringify(data,null,2),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":`attachment; filename="agrar-mentor-backup-${stamp}.json"`,"Cache-Control":"no-store"}});
}
