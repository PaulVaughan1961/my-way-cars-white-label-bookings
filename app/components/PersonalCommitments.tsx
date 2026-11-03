"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { commitmentTime, commitmentsForDay, DEFAULT_PERSONAL_DRIVER, findPersonalJobClashes, moveDay, moveMinutes, normaliseDriverName, PERSONAL_DRIVER_METADATA_KEY, personalClashesForDay, personalDateTime, ukToday, type PersonalClashBooking, type PersonalCommitment, type PersonalJobClash } from "@/lib/personalCommitments";

export function usePersonalCommitments(from: string, to: string, bookings: PersonalClashBooking[], availableDrivers: string[] = []) {
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<PersonalCommitment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [driverName, setDriverName] = useState(DEFAULT_PERSONAL_DRIVER);
  const [driverReady, setDriverReady] = useState(false);
  const [driverError, setDriverError] = useState("");
  const [savingDriver, setSavingDriver] = useState(false);
  const requestId = useRef(0);
  const authUser = useRef<string | null>(null);

  const reload = useCallback(async () => {
    const request = ++requestId.current;
    const client = getSupabase();
    // RPCs use POST, keeping private diary responses out of GET runtime caches.
    const access = await client.rpc("my_way_personal_calendar_enabled");
    if (request !== requestId.current) return;
    if (access.error || access.data !== true) {
      setEnabled(false); setEntries([]); setError(""); setLoading(false); setDriverReady(false); return;
    }
    setEnabled(true); setLoading(true);
    const [result, userResult] = await Promise.all([
      client.rpc("my_way_list_personal_commitments", {
        requested_from: `${from}T00:00`, requested_to: `${to}T00:00`,
      }),
      client.auth.getUser(),
    ]);
    if (request !== requestId.current) return;
    setLoading(false);
    if (userResult.error || !userResult.data.user) {
      setDriverReady(false); setDriverError("Your driver-name setting could not be loaded. Please try again.");
    } else {
      const savedName: unknown = userResult.data.user.user_metadata?.[PERSONAL_DRIVER_METADATA_KEY];
      setDriverName(typeof savedName === "string" && savedName.trim() ? savedName.trim() : DEFAULT_PERSONAL_DRIVER);
      setDriverReady(true); setDriverError("");
    }
    if (result.error) {
      setEntries([]); setError("Your personal diary could not be loaded. Please try again."); return;
    }
    const rows = (result.data || []) as PersonalCommitment[];
    if (rows.length > 500) {
      setEntries([]); setError("There are too many personal commitments in this date range."); return;
    }
    setEntries(rows); setError("");
  }, [from, to]);

  useEffect(() => {
    void reload();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id || null;
      if (authUser.current === userId) return;
      authUser.current = userId;
      ++requestId.current; setEnabled(false); setEntries([]); setError(""); setDriverReady(false);
      // Avoid making another auth request inside the auth callback.
      clearTimeout(timer); timer = setTimeout(() => void reload(), 0);
    });
    const refresh = () => void reload();
    window.addEventListener("focus", refresh);
    return () => {
      ++requestId.current; clearTimeout(timer); subscription.unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);

  async function changeDriver(value: string) {
    setSavingDriver(true); setDriverError("");
    const request = requestId.current;
    try {
      const { error: failure } = await getSupabase().auth.updateUser({ data: { [PERSONAL_DRIVER_METADATA_KEY]: value } });
      if (failure) throw failure;
      if (request === requestId.current) { setDriverName(value); setDriverReady(true); }
      else await reload();
    } catch {
      if (request === requestId.current) setDriverError("Your driver name could not be saved. Please try again.");
    } finally { setSavingDriver(false); }
  }

  const names = [driverName, ...availableDrivers, ...bookings.map(job => job.driver_name || "")].map(name => name.trim()).filter(Boolean);
  const driverNames = names.filter((name, index) => names.findIndex(value => normaliseDriverName(value) === normaliseDriverName(name)) === index).sort();
  const clashes = useMemo(() => enabled && driverReady ? findPersonalJobClashes(entries, bookings, driverName) : [], [enabled, driverReady, entries, bookings, driverName]);
  return { enabled, entries, error, loading, reload, bookings, driverName, driverNames, driverReady, driverError, savingDriver, changeDriver, clashes };
}

type DiaryState = ReturnType<typeof usePersonalCommitments>;

function PersonalClashWarnings({ clashes }: { clashes: PersonalJobClash[] }) {
  if (!clashes.length) return null;
  return <div role="status" className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-950">
    <p className="font-bold">Possible clash{clashes.length === 1 ? "" : "es"} with your jobs</p>
    <ul className="mt-2 space-y-2">{clashes.map(clash => <li key={clash.key}>
      <span className="font-semibold">{clash.commitmentTitle}</span> ({personalDateTime(clash.commitmentStart)}–{personalDateTime(clash.commitmentEnd)}) overlaps {clash.passengerName} at {personalDateTime(clash.bookingStart)}.
      {" "}<Link href={`/dashboard?focus=${encodeURIComponent(clash.bookingId)}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline">View job</Link>
    </li>)}</ul>
    <p className="mt-2 text-xs">Estimated job time: 30 minutes for local/unspecified jobs; 2 hours for airport/long-distance jobs. Allow for travel and actual journey length.</p>
  </div>;
}

function PersonalCommitmentEditor({ entry, date, bookings, driverName, driverReady, onClose, onSaved }: {
  entry: PersonalCommitment | null; date: string; onClose: () => void; onSaved: () => Promise<void>;
  bookings: PersonalClashBooking[]; driverName: string; driverReady: boolean;
}) {
  const [id] = useState(() => entry?.id || crypto.randomUUID());
  const [title, setTitle] = useState(entry?.title || "");
  const [start, setStart] = useState(entry?.starts_at.slice(0, 16) || `${date}T09:00`);
  const [end, setEnd] = useState(entry?.ends_at.slice(0, 16) || `${date}T10:00`);
  const [allDay, setAllDay] = useState(entry?.all_day || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = entry ? "Edit personal commitment" : "Add personal commitment";
  const titleInput = useRef<HTMLInputElement>(null);
  const validDay = /^\d{4}-\d{2}-\d{2}T/.test(start);
  const preview = driverReady ? findPersonalJobClashes([{
    id, title: title.trim() || "This commitment", all_day: allDay,
    starts_at: allDay && validDay ? `${start.slice(0, 10)}T00:00` : start,
    ends_at: allDay && validDay ? `${moveDay(start.slice(0, 10), 1)}T00:00` : end,
  }], bookings, driverName) : [];

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    titleInput.current?.focus();
    return () => previous?.focus();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (allDay && !validDay) { setError("Please choose a date."); return; }
    const startsAt = allDay ? `${start.slice(0, 10)}T00:00` : start;
    const endsAt = allDay ? `${moveDay(start.slice(0, 10), 1)}T00:00` : end;
    if (!title.trim()) { setError("Please enter a title."); return; }
    if (!startsAt || !endsAt || endsAt <= startsAt) { setError("The end must be after the start."); return; }
    setBusy(true); setError("");
    try {
      const { error: failure } = await getSupabase().rpc("my_way_save_personal_commitment", {
        requested_id: id, requested_title: title.trim(), requested_start: startsAt,
        requested_end: endsAt, requested_all_day: allDay,
      });
      if (failure) throw failure;
      await onSaved(); onClose();
    } catch {
      setError("Your commitment could not be saved. Please try again.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!entry || !window.confirm("Delete this personal commitment?")) return;
    setBusy(true); setError("");
    try {
      const { error: failure } = await getSupabase().rpc("my_way_delete_personal_commitment", { requested_id: entry.id });
      if (failure) throw failure;
      await onSaved(); onClose();
    } catch {
      setError("Your commitment could not be deleted. Please try again.");
    } finally { setBusy(false); }
  }

  const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900";
  return <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12 print:hidden"
    onKeyDown={event => { if (event.key === "Escape" && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="personal-heading" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div><h2 id="personal-heading" className="text-xl font-bold text-slate-900">{heading}</h2><p className="mt-1 text-sm text-violet-800">Your private diary · UK time</p></div>
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border px-3 py-2 disabled:opacity-50">Close</button>
      </div>
      <form onSubmit={save} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold">Title
          <input ref={titleInput} required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="For example, car MOT" className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={allDay} onChange={event => setAllDay(event.target.checked)} className="h-5 w-5" />All day</label>
        {allDay ? <label className="block text-sm font-semibold">Date
          <input required type="date" value={start.slice(0, 10)} onChange={event => setStart(event.target.value ? `${event.target.value}T09:00` : "")} className={field} />
        </label> : <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Starts (UK time)
            <input required type="datetime-local" value={start} onChange={event => {
              const value = event.target.value; setStart(value);
              if (value && end <= value) setEnd(moveMinutes(value, 60));
            }} className={field} />
          </label>
          <label className="block text-sm font-semibold">Ends (UK time)
            <input required type="datetime-local" value={end} onChange={event => setEnd(event.target.value)} className={field} />
          </label>
        </div>}
        <PersonalClashWarnings clashes={preview} />
        {!driverReady && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your assigned-job clash check is unavailable until your driver-name setting is loaded.</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {entry && <button type="button" onClick={() => void remove()} disabled={busy} className="rounded-xl border border-red-300 px-4 py-3 font-semibold text-red-800 disabled:opacity-50">Delete</button>}
          <button type="submit" disabled={busy} className="ml-auto rounded-xl bg-violet-800 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save commitment"}</button>
        </div>
      </form>
    </section>
  </div>;
}

export function PersonalCommitmentsPanel({ diary, date, compact = false }: {
  diary: DiaryState; date?: string | null; compact?: boolean;
}) {
  const [editing, setEditing] = useState<PersonalCommitment | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  if (!diary.enabled) return null;
  const entries = date ? commitmentsForDay(diary.entries, date) : diary.entries;
  const shown = compact ? entries.slice(0, 4) : entries;
  const clashes = date ? personalClashesForDay(diary.clashes, date) : diary.clashes;
  const content = <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      {!compact && <div><span className="font-bold text-violet-950">Personal diary</span><span className="ml-2 text-xs font-medium text-violet-800">Private</span></div>}
      <div className="flex flex-wrap gap-2">
        {compact && <Link href="/calendar" className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-900">View calendar</Link>}
        <button type="button" onClick={() => { setSaved(false); setEditing(null); }} className="rounded-lg bg-violet-800 px-3 py-2 text-sm font-semibold text-white">+ Add personal commitment</button>
      </div>
    </div>
    <div className="mt-3 text-sm text-violet-950">
      <label className="font-semibold">My driver name
        <select value={diary.driverName} disabled={!diary.driverReady || diary.savingDriver} onChange={event => void diary.changeDriver(event.target.value)} className="ml-2 max-w-full rounded-lg border border-violet-300 bg-white px-2 py-1 font-normal disabled:opacity-50">
          {diary.driverNames.map(name => <option key={normaliseDriverName(name)} value={name}>{name}</option>)}
        </select>
      </label>
      <span className="ml-2 text-xs">{diary.savingDriver ? "Saving…" : "Clash checks use this assigned-driver name."}</span>
      {diary.driverError && <p role="alert" className="mt-1 text-red-800">{diary.driverError} <button type="button" onClick={() => void diary.reload()} className="underline">Try again</button></p>}
    </div>
    <PersonalClashWarnings clashes={clashes} />
    {saved && <p role="status" className="mt-2 text-sm font-semibold text-violet-900">Personal diary updated.</p>}
    {diary.error ? <p role="alert" className="mt-2 text-sm text-red-800">{diary.error} <button type="button" onClick={() => void diary.reload()} className="underline">Try again</button></p>
      : diary.loading && !shown.length ? <p className="mt-2 text-sm text-violet-900">Loading your diary…</p>
      : !date && !compact ? <p className="mt-2 text-sm text-violet-900">Select a day to see its personal commitments.</p>
      : !shown.length ? <p className="mt-2 text-sm text-violet-900">{compact ? "No personal commitments in the next 7 days." : "No personal commitments on this day."}</p>
      : <ul className="mt-2 space-y-1">{shown.map(entry => <li key={entry.id}>
        <button type="button" onClick={() => setEditing(entry)} className="w-full break-words rounded-lg px-1 py-2 text-left text-sm text-violet-950 hover:bg-violet-100">
          <span className="font-semibold">{compact ? `${new Date(`${entry.starts_at.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" })} · ` : ""}{commitmentTime(entry, date || undefined)}</span> · {entry.title}<span className="ml-2 text-xs underline">Edit</span>
        </button>
      </li>)}</ul>}
    {compact && entries.length > shown.length && <Link href="/calendar" className="mt-2 inline-block text-sm font-semibold text-violet-900 underline">View all personal commitments</Link>}
    {editing !== undefined && <PersonalCommitmentEditor entry={editing} date={date || ukToday()} bookings={diary.bookings} driverName={diary.driverName} driverReady={diary.driverReady} onClose={() => setEditing(undefined)} onSaved={async () => { await diary.reload(); setSaved(true); }} />}
  </>;
  if (compact) return <details className="group rounded-2xl border border-violet-200 bg-violet-50 print:hidden">
    <summary className="cursor-pointer px-4 py-3 text-sm text-violet-950">
      <span className="font-bold">Personal diary</span>
      <span className="ml-2 text-xs">{diary.error || diary.driverError ? "Needs attention" : diary.loading ? "Loading…" : `${entries.length} in the next 7 days`}</span>
      {clashes.length > 0 && <span className="ml-2 rounded bg-red-700 px-2 py-0.5 text-xs font-bold text-white">{clashes.length} clash{clashes.length === 1 ? "" : "es"}</span>}
      <span className="float-right text-xs font-semibold group-open:hidden">Show</span>
      <span className="float-right hidden text-xs font-semibold group-open:inline">Hide</span>
    </summary>
    <div className="border-t border-violet-200 px-4 py-3">{content}</div>
  </details>;
  return <aside aria-label="Personal diary" className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 print:hidden">{content}</aside>;
}

export default function PersonalDiaryStrip({ bookings, driverNames }: { bookings: PersonalClashBooking[]; driverNames: string[] }) {
  const today = ukToday();
  const diary = usePersonalCommitments(today, moveDay(today, 7), bookings, driverNames);
  return <PersonalCommitmentsPanel diary={diary} compact />;
}
