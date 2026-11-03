export type PersonalCommitment = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
};

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
