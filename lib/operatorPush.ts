import * as webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { requestPassengerInfo } from "@/lib/passengerCount";

type BookingPayload = Record<string, unknown>;

function pickText(payload: BookingPayload, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) throw new Error("Supabase server configuration is incomplete.");
  return createClient(url, secretKey, { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
}

export async function notifyOperatorNewBookingRequest(input:{businessId:string;businessName:string;payload:BookingPayload;event?:"confirmed"|"accepted_quote"|"declined_quote"|"recheck"}) {
  const publicKey=process.env.VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT || "mailto:notifications@mywaycars.co.uk";
  if(!publicKey || !privateKey){console.warn("Operator push skipped: VAPID keys are not configured.");return {sent:0,skipped:true};}

  const supabase=serverClient();
  const {data:subs,error}=await supabase.from("operator_push_subscriptions").select("id,endpoint,p256dh,auth").eq("business_id",input.businessId);
  if(error){console.error("Operator push lookup failed:",error.message);return {sent:0};}
  if(!subs?.length)return {sent:0};

  webpush.setVapidDetails(subject,publicKey,privateKey);

  const outward = input.payload.outward && typeof input.payload.outward === "object" ? input.payload.outward as BookingPayload : {};
  const name=pickText(input.payload,["passengerName","passenger_name","lead_passenger","customer_name","name","account_name"])||"Customer";
  const pickup=pickText(outward,["pickupAddress"])||pickText(input.payload,["pickup_address","pickup","from_address"]);
  const dropoff=pickText(outward,["dropoffAddress"])||pickText(input.payload,["dropoff_address","dropoff","to_address"]);
  const when=pickText(outward,["pickupDateTime"])||pickText(input.payload,["pickup_datetime","pickup_at","journey_at","date_time"]);
  const journey=[pickup,dropoff].filter(Boolean).join(" to ");
  const passengers = input.event ? null : requestPassengerInfo(input.payload);
  const detail=[passengers?.label,name,when,journey].filter(Boolean).join(" | ");
  const label = input.event === "confirmed" ? "NEW BOOKING: customer confirmed — check driver assignment" : input.event === "accepted_quote" ? "CUSTOMER ACCEPTED: confirm booking and assign driver" : input.event === "declined_quote" ? "customer declined quote" : input.event === "recheck" ? "availability recheck requested" : input.payload.requestIntent === "enquiry" ? "new enquiry" : input.payload.requestIntent === "booking" ? "new booking request" : "new request: intent not specified";
  const payload=JSON.stringify({title:`${input.businessName}: ${passengers?.requiresLargerVehicle ? "MINIBUS / LARGER VEHICLE OR TWO VEHICLES — " : ""}${label}`,body:detail||"A new customer booking request needs your attention.",url:"/dashboard",tag:`booking-request-${Date.now()}`});

  let sent=0;
  await Promise.all(subs.map(async row=>{
    try{
      await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},payload); sent++;
    }catch(error){
      const statusCode=typeof error==="object"&&error&&"statusCode" in error&&typeof (error as {statusCode?:unknown}).statusCode==="number"?(error as {statusCode:number}).statusCode:0;
      if(statusCode===404||statusCode===410){await supabase.from("operator_push_subscriptions").delete().eq("id",row.id);return;}
      console.error("Operator push send failed:",error);
    }
  }));
  return {sent};
}
