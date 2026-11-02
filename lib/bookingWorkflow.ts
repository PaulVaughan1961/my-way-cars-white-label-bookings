export function isTentative(status: unknown) {
  return status === "Pending Approval" || status === "TBC";
}

export function requestIntentLabel(intent: unknown) {
  if (intent === "enquiry") return "ENQUIRY";
  if (intent === "booking") return "BOOKING REQUEST";
  return "INTENT NOT SPECIFIED";
}

export function ukDateTime(value: string) {
  // Bookings store UK wall time, whereas deadlines are absolute instants.
  // Render a booking wall time literally, without the viewer's timezone.
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]} at ${match[4]}:${match[5]}` : value;
}

export function deadlineText(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
}
