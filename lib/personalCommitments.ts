export type PersonalCommitment = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
};

export type PersonalClashBooking = {
  id: string;
  driver_name?: string | null;
  passenger_name?: string | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  pickup_datetime?: string | null;
  booking_type?: string | null;
  status?: string | null;
  driver_assignment_status?: string | null;
};

export type PersonalJobClash = {
  key: string;
  commitmentId: string;
  commitmentTitle: string;
  bookingId: string;
  passengerName: string;
  bookingStart: string;
  bookingEnd: string;
  commitmentStart: string;
  commitmentEnd: string;
  overlapStart: string;
  overlapEnd: string;
  estimatedMinutes: number;
};

export const DEFAULT_PERSONAL_DRIVER = "Paul Vaughan";
export const PERSONAL_DRIVER_METADATA_KEY = "my_way_personal_driver_name";

export function normaliseDriverName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function wallMinute(value: string) {
  const match = value.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/);
  if (!match) return Number.NaN;
  const canonical = match[0].replace(" ", "T");
  const ms = Date.parse(`${canonical}:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 16) === canonical ? ms : Number.NaN;
}

export function personalJobMinutes(type: string | null | undefined, pickup?: string | null, dropoff?: string | null) {
  const value = (type || "").trim().toLowerCase();
  // Older bookings can have no type even when their route names an airport.
  const airportRoute = [pickup, dropoff].some(address => /\b(?:airports?|heathrow|gatwick)\b/i.test(address || ""));
  // Match the existing booking-clash windows; these are estimates, not actual journey ends.
  return value.includes("airport") || value.includes("long") || airportRoute ? 120 : 30;
}

export function findPersonalJobClashes(entries: PersonalCommitment[], bookings: PersonalClashBooking[], driverName: string) {
  const driver = normaliseDriverName(driverName);
  if (!driver) return [];
  const excluded = new Set(["cancelled", "rejected", "completed", "pending approval", "tbc"]);
  const clashes: PersonalJobClash[] = [];
  for (const booking of bookings) {
    if (normaliseDriverName(booking.driver_name || "") !== driver
      || excluded.has((booking.status || "Scheduled").trim().toLowerCase())
      || ["declined", "rejected"].includes((booking.driver_assignment_status || "").trim().toLowerCase())) continue;
    const start = wallMinute(booking.pickup_datetime || "");
    if (!Number.isFinite(start)) continue;
    const estimatedMinutes = personalJobMinutes(booking.booking_type, booking.pickup_address, booking.dropoff_address);
    const end = start + estimatedMinutes * 60_000;
    for (const entry of entries) {
      const personalStart = wallMinute(entry.starts_at);
      const personalEnd = wallMinute(entry.ends_at);
      if (!Number.isFinite(personalStart) || !Number.isFinite(personalEnd) || personalEnd <= personalStart) continue;
      if (start >= personalEnd || end <= personalStart) continue;
      const minute = (ms: number) => new Date(ms).toISOString().slice(0, 16);
      clashes.push({
        key: `${entry.id}:${booking.id}`, commitmentId: entry.id, commitmentTitle: entry.title,
        bookingId: booking.id, passengerName: booking.passenger_name || "Unnamed booking",
        bookingStart: minute(start), bookingEnd: minute(end),
        commitmentStart: minute(personalStart), commitmentEnd: minute(personalEnd),
        overlapStart: minute(Math.max(start, personalStart)), overlapEnd: minute(Math.min(end, personalEnd)),
        estimatedMinutes,
      });
    }
  }
  return clashes.sort((a, b) => a.overlapStart.localeCompare(b.overlapStart) || a.key.localeCompare(b.key));
}

export function personalClashesForDay(clashes: PersonalJobClash[], day: string) {
  return clashes.filter(clash => clash.overlapStart < `${moveDay(day, 1)}T00:00` && clash.overlapEnd > `${day}T00:00`);
}

export function personalDateTime(value: string) {
  return `${value.slice(8, 10)}/${value.slice(5, 7)} ${value.slice(11, 16)}`;
}

export function ukToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// These are UK wall-clock appointments, matching the date/time entered in the form.
export function moveDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function moveMinutes(value: string, amount: number) {
  return new Date(new Date(`${value.slice(0, 16)}:00Z`).getTime() + amount * 60_000)
    .toISOString().slice(0, 16);
}

export function commitmentsForDay(entries: PersonalCommitment[], day: string) {
  return entries.filter(entry =>
    entry.starts_at.slice(0, 16) < `${moveDay(day, 1)}T00:00` && entry.ends_at.slice(0, 16) > `${day}T00:00`
  );
}

export function commitmentTime(entry: PersonalCommitment, day?: string) {
  if (entry.all_day) return "All day";
  const start = day && entry.starts_at.slice(0, 10) < day ? "00:00" : entry.starts_at.slice(11, 16);
  const end = day && entry.ends_at.slice(0, 10) > day ? "24:00" : entry.ends_at.slice(11, 16);
  return `${start}–${end}`;
}
