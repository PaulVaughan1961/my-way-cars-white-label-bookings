"use client";
import { useEffect,useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

function keyBytes(s:string){const p="=".repeat((4-s.length%4)%4);const b=(s+p).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from([...atob(b)].map(c=>c.charCodeAt(0)));}
async function token(){const {data:{session}}=await getSupabase().auth.getSession();return session?.access_token||"";}

export default function OperatorPushNotifications(){
  const [supported,setSupported]=useState(true),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{const ok="serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;setSupported(ok);if(!ok)return;void navigator.serviceWorker.getRegistration().then(async r=>{if(r)setEnabled(Boolean(await r.pushManager.getSubscription()));});},[]);
  async function enable(){
    setBusy(true);setMessage("");
    try{
      const t=await token();if(!t)throw new Error("Please sign in again before enabling alerts.");
      const kr=await fetch("/api/operator-push",{headers:{Authorization:`Bearer ${t}`},cache:"no-store"});const k=await kr.json();
      if(!kr.ok||!k.publicKey)throw new Error(k.error||"Push notifications are not configured.");
      if(await Notification.requestPermission()!=="granted")throw new Error("Notification permission was not granted.");
      const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(k.publicKey) as BufferSource});
      const sr=await fetch("/api/operator-push",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify(sub.toJSON())});const s=await sr.json();
      if(!sr.ok)throw new Error(s.error||"Could not enable booking alerts.");
      setEnabled(true);setMessage("Booking alerts enabled on this device.");
    }catch(e){setMessage(e instanceof Error?e.message:"Could not enable booking alerts.");}finally{setBusy(false);}
  }
  async function disable(){
    setBusy(true);setMessage("");
    try{
      const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager.getSubscription();
      if(sub){const t=await token();if(t)await fetch("/api/operator-push",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({endpoint:sub.endpoint})});await sub.unsubscribe();}
      setEnabled(false);setMessage("Booking alerts disabled on this device.");
    }catch(e){setMessage(e instanceof Error?e.message:"Could not disable booking alerts.");}finally{setBusy(false);}
  }
  if(!supported)return null;
  return <div className="flex flex-col items-start gap-1"><button type="button" disabled={busy} onClick={enabled?disable:enable} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-50">{busy?"Workingâ€¦":enabled?"Booking alerts: ON":"Enable booking alerts"}</button>{message?<span className="max-w-xs text-xs text-slate-600">{message}</span>:null}</div>;
}