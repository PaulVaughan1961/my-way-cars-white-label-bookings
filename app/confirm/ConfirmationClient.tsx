"use client";
import { useEffect, useRef, useState } from "react";
import { deadlineText, ukDateTime } from "@/lib/bookingWorkflow";

type Journey = { id: string; passengerName: string; pickup: string; dropoff: string; pickupDateTime: string; fare: number; passengers: number; largeBags: number; smallBags: number; flightNumber?: string; via?: string };
type Quote = { quoteId: string; businessName: string; contactPhone: string; state: string; expiresAt: string; total: number; holdAvailability: boolean; journeys: Journey[]; canRecheck: boolean };
const money = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);

export default function ConfirmationClient() {
  const token = useRef("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  async function act(action: "view" | "confirm" | "decline" | "recheck") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/booking-quotes", { method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to check this quote. Please try again.");
      setQuote(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to check this quote."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    token.current = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    if (!token.current) { setError("This confirmation link is incomplete. Please contact your operator."); setBusy(false); return; }
    void act("view");
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const expired = quote?.state === "expired" || (quote?.state === "issued" && now >= Date.parse(quote.expiresAt));
  const ready = quote?.state === "issued" && !expired;
  const callNumber = (quote?.contactPhone || "").replace(/[^0-9+]/g, "");
  return <main className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-lg space-y-5 rounded-2xl bg-white p-6 shadow">
    <h1 className="text-2xl font-bold">{quote?.businessName || "Review your journey"}</h1>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}<button className="mt-3 block underline" disabled={busy} onClick={() => void act("view")}>Try again</button></div>}
    {!quote && busy && <p>Checking your quote...</p>}
    {quote && <>
      <div aria-live="polite" className={`rounded-xl p-4 ${quote.state === "confirmed" ? "bg-green-100 text-green-950" : "bg-amber-50 text-amber-950"}`}>
        {quote.state === "confirmed" ? <><strong>Your booking is confirmed.</strong><p>Keep this page as your confirmation. Contact your operator if your plans change.</p></> :
          quote.state === "awaiting_operator" ? <><strong>Quote accepted — awaiting operator confirmation.</strong><p>Your operator will check availability and contact you. Your journey is not yet confirmed.</p></> :
          quote.state === "declined" ? <><strong>You have declined this quote.</strong><p>Your response has been recorded for your operator. No booking has been confirmed. Contact your operator if you would like a different quote.</p></> :
          quote.state === "recheck_requested" ? <><strong>Your availability request has been received.</strong><p>Your journey is not confirmed. Your operator will contact you.</p></> :
          expired ? <><strong>This quote has expired.</strong><p>Please call us to check availability, or request availability again below.</p></> :
          quote.state === "withdrawn" ? <><strong>This quote has been withdrawn or replaced.</strong><p>Use the latest link sent by your operator, or call us.</p></> :
          !ready ? <><strong>This quote can no longer confirm your journey.</strong><p>Please contact us to check the latest details and availability.</p></> :
          <><strong>Please confirm by {deadlineText(quote.expiresAt)} UK time.</strong><p>{quote.holdAvailability ? "Availability is held until this deadline. Confirm below to book." : "This quote is subject to availability. Accept below and your operator will review it."}</p></>}
      </div>
      <p className="text-xs text-slate-500">Quote reference: {quote.quoteId}</p>
      {quote.journeys.map((journey, index) => <section key={journey.id} className="space-y-2 rounded-xl border p-4">
        <h2 className="font-bold">{quote.journeys.length > 1 ? index === 0 ? "Outward journey" : "Return journey" : "Your journey"}</h2>
        <p>{journey.passengerName}</p><p>{ukDateTime(journey.pickupDateTime)} UK time</p>
        <p><strong>From:</strong> {journey.pickup}</p><p><strong>To:</strong> {journey.dropoff}</p>
        {journey.via && <p><strong>Via:</strong> {journey.via}</p>}
        {journey.flightNumber && <p><strong>Flight:</strong> {journey.flightNumber}</p>}
        <p>{journey.passengers} passenger(s); {journey.largeBags} large and {journey.smallBags} small bag(s)</p>
        <p className="font-bold">{money(journey.fare)}</p>
      </section>)}
      <p className="text-xl font-bold">Minimum total: {money(quote.total)}</p>
      <p className="text-sm text-slate-600">The quoted amount is the minimum fare. Additional airport parking charges may apply if parking exceeds 30 minutes. Payment is arranged with your operator.</p>
      {ready && <button disabled={busy} onClick={() => void act("confirm")} className="w-full rounded-xl bg-green-700 p-4 font-bold text-white disabled:opacity-50">
        {busy ? "Please wait..." : quote.holdAvailability ? "Confirm this booking" : "Accept quote and request booking"}
      </button>}
      {ready && <button disabled={busy} onClick={() => void act("decline")} className="w-full rounded-xl border border-red-500 p-3 font-semibold text-red-800 disabled:opacity-50">Decline quote</button>}
      {callNumber && <a href={`tel:${callNumber}`} className="block rounded-xl bg-slate-900 p-4 text-center font-bold text-white">Call {quote.businessName}</a>}
      {(quote.canRecheck || (expired && quote.state === "issued")) && <button disabled={busy} onClick={() => void act("recheck")} className="w-full rounded-xl border border-slate-400 p-4 font-semibold disabled:opacity-50">{busy ? "Please wait..." : "Request availability again"}</button>}
    </>}
  </div></main>;
}
