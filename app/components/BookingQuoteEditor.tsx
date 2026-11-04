"use client";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { deadlineText, ukDateTime } from "@/lib/bookingWorkflow";
import PassengerCount from "@/app/components/PassengerCount";
import { passengerInfo } from "@/lib/passengerCount";

export type QuoteJourney = { id: string; passenger_name?: string | null; passenger_phone?: string | null; passengers?: number | string | null; customer_email?: string | null; notes?: string | null; pickup_address?: string | null; dropoff_address?: string | null; pickup_datetime?: string | null; fare?: number | string | null; status?: string | null };
export type QuoteSummary = { bookingId: string; expiresAt: string; state: string; holdAvailability: boolean; total: number };

export default function BookingQuoteEditor({ journeys, businessName, onClose, onSaved }: {
  journeys: QuoteJourney[]; businessName: string; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [fares, setFares] = useState<Record<string, string>>(() => Object.fromEntries(journeys.map(j => [j.id, j.fare == null ? "" : String(j.fare)])));
  // No unagreed default cutoff: the operator must choose it before issuing a quote.
  const [lifetime, setLifetime] = useState("");
  const [notice, setNotice] = useState("");
  const [hold, setHold] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ confirmationUrl: string; expiresAt: string; total: number; holdAvailability: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const first = journeys[0];
  const phone = first?.passenger_phone?.replace(/[^0-9+]/g, "") || "";
  const email = first?.customer_email || first?.notes?.match(/^Customer email:\s*(.+)$/im)?.[1]?.trim() || "";
  const message = issued ? `${businessName}\n\nYour minimum journey price: GBP ${Number(issued.total).toFixed(2)}${journeys.length > 1 ? " total for both journeys" : ""}.\n${journeys.map(j => `${ukDateTime(j.pickup_datetime || "")} UK time: ${j.pickup_address} to ${j.dropoff_address}`).join("\n")}\n\nPlease respond by ${deadlineText(issued.expiresAt)} UK time. ${issued.holdAvailability ? "Availability is held until that deadline." : "Subject to availability; we will confirm after you accept."}\n\nThe quoted amount is the minimum fare. Additional airport parking charges may apply if parking exceeds 30 minutes.\n\nReview your quote and respond:\n${issued.confirmationUrl}` : "";

  async function issue(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch("/api/booking-requests/workflow", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "quote", bookingId: first.id, fares: Object.fromEntries(Object.entries(fares).map(([id, value]) => [id, Number(value)])),
          lifetimeHours: Number(lifetime), noticeHours: Number(notice), holdAvailability: hold }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to issue quote.");
      setIssued(result); await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to issue quote."); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="quote-heading">
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4"><h2 id="quote-heading" className="text-xl font-bold">Quote and customer confirmation</h2><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border px-3 py-2">Close</button></div>
      <p className="text-sm">{first?.passenger_name}. {journeys.length > 1 ? "This quote covers both linked journeys." : "This quote covers this journey."}</p>
      <div className="flex flex-wrap gap-2">{journeys.map((j, i) => <PassengerCount key={j.id} value={j.passengers} journey={journeys.length > 1 ? i === 0 ? "Outward" : "Return" : undefined} />)}</div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      {issued ? <>
        <p className="rounded-xl bg-green-50 p-3 font-semibold">Quote prepared. Confirmation closes {deadlineText(issued.expiresAt)} UK time.</p>
        <p className="text-sm">Send this private link to the customer. Creating another quote replaces this link.</p>
        <textarea aria-label="Quote message" readOnly value={message} rows={10} className="w-full rounded-xl border p-3 text-sm" />
        <button className="w-full rounded-xl border p-3 font-semibold" onClick={async () => {
          try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setError("Select and copy the message above."); }
        }}>{copied ? "Copied" : "Copy quote message"}</button>
        {phone && <a className="block rounded-xl bg-blue-700 p-3 text-center font-bold text-white" href={`sms:${phone}?body=${encodeURIComponent(message)}`}>Open quote in text message</a>}
        {email && <a className="block rounded-xl border p-3 text-center font-semibold" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`${businessName} journey quote`)}&body=${encodeURIComponent(message)}`}>Open quote in email</a>}
      </> : <form onSubmit={issue} className="space-y-4">
        {journeys.map((j, i) => <label key={j.id} className="block rounded-xl border p-3 text-sm">
          <span className="block font-semibold">{journeys.length > 1 ? i === 0 ? "Outward" : "Return" : "Journey"}: {ukDateTime(j.pickup_datetime || "")}</span>
          <span className="block">{j.pickup_address} to {j.dropoff_address}</span>
          <span className="mt-2 block font-bold">{passengerInfo(j.passengers).label}</span>
          {passengerInfo(j.passengers).requiresLargerVehicle && <span className="block text-xs text-amber-900">Check capacity: minibus, larger vehicle or two vehicles.</span>}
          Price (GBP)<input required type="number" min="0" max="100000" step="0.01" value={fares[j.id] || ""} onChange={e => setFares(old => ({ ...old, [j.id]: e.target.value }))} className="mt-1 w-full rounded-lg border p-3" />
        </label>)}
        <label className="block text-sm font-semibold">Quote valid for (hours after creation)
          <input required type="number" min="0.25" max="8760" step="0.25" placeholder="For example, 24" value={lifetime} onChange={e => setLifetime(e.target.value)} className="mt-1 w-full rounded-lg border p-3" />
        </label>
        <label className="block text-sm font-semibold">Customer must confirm at least this many hours before travel
          <input required type="number" min="1" max="8760" step="0.25" placeholder="For example, 12, 24 or 48" value={notice} onChange={e => setNotice(e.target.value)} className="mt-1 w-full rounded-lg border p-3" />
        </label>
        <p className="text-sm text-slate-600">The earlier deadline applies, using the first journey for a return booking. After expiry the customer can call or request availability again.</p>
        <label className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm"><input type="checkbox" checked={hold} onChange={e => setHold(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" /><span><strong>I have reserved availability until the deadline.</strong> The customer can confirm automatically. Leave unticked to require operator approval after acceptance. Check your other bookings and outstanding holds before ticking.</span></label>
        <button disabled={busy} className="w-full rounded-xl bg-purple-800 p-4 font-bold text-white disabled:opacity-50">{busy ? "Preparing..." : "Create confirmation link"}</button>
      </form>}
    </div>
  </div>;
}
