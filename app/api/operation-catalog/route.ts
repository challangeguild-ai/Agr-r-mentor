import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

const countries=new Set(["HU","SK"]);
const operationTypes=new Set(["spraying","plant_protection","fertilizing","sowing","soil_work","harvest","irrigation","mowing","other"]);

export async function GET(request:NextRequest){
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Nincs bejelentkezve."},{status:401});

  const country=request.nextUrl.searchParams.get("country")||"HU";
  const type=request.nextUrl.searchParams.get("type")||"spraying";
  const farmId=request.nextUrl.searchParams.get("farm")||"";
  if(!countries.has(country)||!operationTypes.has(type))return NextResponse.json({error:"Érvénytelen katalóguskérés."},{status:400});

  const[{data:catalog,error:catalogError},{data:source}]=await Promise.all([
    supabase.from("operation_catalog").select("id,country_code,operation_type,category,name,metadata,sort_order").in("country_code",[country,"ALL"]).eq("operation_type",type).eq("active",true).order("sort_order").order("name"),
    supabase.from("operation_catalog_sources").select("country_code,source_name,source_url,last_checked_at,last_imported_at,product_count,use_count,status,notes").eq("country_code",country).maybeSingle(),
  ]);
  if(catalogError)return NextResponse.json({error:catalogError.message},{status:500});

  let approvers:any[]=[];
  if(farmId){
    const today=new Date().toISOString().slice(0,10);
    const{data:authorizations}=await supabase.from("farm_plant_protection_approvers").select("user_id,authorization_level,permit_number,valid_until,active").eq("farm_id",farmId).eq("active",true).or(`valid_until.is.null,valid_until.gte.${today}`);
    const ids=(authorizations??[]).map(x=>x.user_id);
    if(ids.length){
      const{data:profiles}=await supabase.from("profiles").select("id,full_name,role").in("id",ids);
      const profileMap=new Map((profiles??[]).map(p=>[p.id,p]));
      approvers=(authorizations??[]).map(a=>({id:a.user_id,full_name:profileMap.get(a.user_id)?.full_name||"Gazdasági jogosult",role:profileMap.get(a.user_id)?.role||null,authorization_level:a.authorization_level,permit_number:a.permit_number,valid_until:a.valid_until})).filter(a=>a.role!=="advisor");
    }
  }

  if(type!=="spraying"&&type!=="plant_protection")return NextResponse.json({country,type,catalog:catalog??[],products:[],uses:[],approvers,source});

  const today=new Date().toISOString().slice(0,10);
  const{data:products,error:productError}=await supabase.from("plant_protection_products").select("id,name,authorization_number,function_type,valid_from,valid_until,source_name,source_checked_at,regulatory_category,professional_use_only,prescription_required,approval_required").eq("country_code",country).eq("active",true).or(`valid_until.is.null,valid_until.gte.${today}`).order("name").limit(3000);
  if(productError)return NextResponse.json({error:productError.message},{status:500});
  const productIds=(products??[]).map(p=>p.id);
  if(!productIds.length)return NextResponse.json({country,type,catalog:catalog??[],products:[],uses:[],ingredients:[],approvers,source});

  const[{data:uses,error:usesError},{data:ingredients,error:ingredientError}]=await Promise.all([
    supabase.from("plant_protection_uses").select("id,product_id,crop,target,dose_min,dose_max,dose_unit,application_method,phi_days,notes").in("product_id",productIds).order("crop"),
    supabase.from("plant_protection_ingredients").select("product_id,ingredient,concentration,concentration_unit").in("product_id",productIds).order("ingredient"),
  ]);
  if(usesError)return NextResponse.json({error:usesError.message},{status:500});
  if(ingredientError)return NextResponse.json({error:ingredientError.message},{status:500});
  return NextResponse.json({country,type,catalog:catalog??[],products:products??[],uses:uses??[],ingredients:ingredients??[],approvers,source});
}
