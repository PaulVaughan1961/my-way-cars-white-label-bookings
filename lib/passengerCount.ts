export function passengerInfo(value: unknown) {
  const parsed = typeof value === "number" ? value
    : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;
  const count = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  return {
    count,
    label: count === null ? "Passenger count not provided" : `${count} passenger${count === 1 ? "" : "s"}`,
    requiresLargerVehicle: count !== null && count > 4,
  };
}

export function requestPassengerInfo(payload: Record<string, unknown>) {
  const outward = payload.outward && typeof payload.outward === "object" && !Array.isArray(payload.outward)
    ? payload.outward as Record<string, unknown> : {};
  const returnJourney = payload.returnJourney && typeof payload.returnJourney === "object" && !Array.isArray(payload.returnJourney)
    ? payload.returnJourney as Record<string, unknown> : null;
  const first = passengerInfo(outward.passengers ?? payload.passengers);
  const second = returnJourney ? passengerInfo(returnJourney.passengers) : null;
  return {
    label: second ? `Outward: ${first.label}; return: ${second.label}` : first.label,
    requiresLargerVehicle: first.requiresLargerVehicle || !!second?.requiresLargerVehicle,
  };
}
