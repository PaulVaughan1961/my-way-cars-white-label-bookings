import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secretKey)throw new Error("Supabase server configuration is incomplete.");
  return createClient(url,secretKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
async function operatorContext(request:Request){
  const a=request.headers.get("authorization")||"";
  const token=a.startsWith("Bearer ")?a.slice(7).trim():"";
  if(!token)return null;
  const supabase=serverClient();
  const {data:{user},error}=await supabase.auth.getUser(token);
  if(error||!user)return null;
  const {data:operator,error:oe}=await supabase.from("operator_users").select("business_id").eq("user_id",user.id).limit(1).maybeSingle();
  if(oe||!operator?.business_id)return null;
  return {supabase,userId:user.id,businessId:String(operator.business_id)};
}
export async function GET(request:Request){
  const c=await operatorContext(request); if(!c)return NextResponse.json({error:"Unauthorised."},{status:401});
  const publicKey=process.env.VAPID_PUBLIC_KEY;
  if(!publicKey)return NextResponse.json({error:"Push notifications are not configured."},{status:503});
  return NextResponse.json({publicKey});
}
export async function POST(request:Request){
  const c=await operatorContext(request); if(!c)return NextResponse.json({error:"Unauthorised."},{status:401});
  const b=await request.json() as {endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}};
  const endpoint=typeof b.endpoint==="string"?b.endpoint.trim():"";
  const p256dh=typeof b.keys?.p256dh==="string"?b.keys.p256dh.trim():"";
  const auth=typeof b.keys?.auth==="string"?b.keys.auth.trim():"";
  if(!endpoint||!p256dh||!auth)return NextResponse.json({error:"Invalid push subscription."},{status:400});
  const {error}=await c.supabase.from("operator_push_subscriptions").upsert({business_id:c.businessId,user_id:c.userId,endpoint,p256dh,auth,user_agent:request.headers.get("user-agent"),updated_at:new Date().toISOString()},{onConflict:"endpoint"});
  if(error){console.error("Saving operator push subscription failed:",error.message);return NextResponse.json({error:"Could not enable booking alerts."},{status:500});}
  return NextResponse.json({enabled:true});
}
export async function DELETE(request:Request){
  const c=await operatorContext(request); if(!c)return NextResponse.json({error:"Unauthorised."},{status:401});
  const b=await request.json() as {endpoint?:unknown}; const endpoint=typeof b.endpoint==="string"?b.endpoint.trim():"";
  if(!endpoint)return NextResponse.json({error:"Invalid endpoint."},{status:400});
  const {error}=await c.supabase.from("operator_push_subscriptions").delete().eq("business_id",c.businessId).eq("user_id",c.userId).eq("endpoint",endpoint);
  if(error)return NextResponse.json({error:"Could not disable booking alerts."},{status:500});
  return NextResponse.json({enabled:false});
}