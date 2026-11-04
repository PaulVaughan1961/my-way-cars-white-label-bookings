import { passengerInfo } from "@/lib/passengerCount";

export default function PassengerCount({ value, journey }: { value: unknown; journey?: string }) {
  const info = passengerInfo(value);
  const colours = info.requiresLargerVehicle ? "border-red-600 bg-red-50 text-red-950"
    : info.count === null ? "border-amber-500 bg-amber-50 text-amber-950"
    : "border-blue-500 bg-blue-50 text-blue-950";
  return <span className={`mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 px-3 py-2 ${colours}`}>
    <strong className="text-lg">{journey ? `${journey}: ` : ""}{info.label}</strong>
    {info.requiresLargerVehicle && <span className="text-sm font-extrabold">CHECK CAPACITY: MINIBUS / LARGER VEHICLE OR TWO VEHICLES</span>}
    {info.count === null && <span className="text-sm font-semibold">Confirm before quoting</span>}
  </span>;
}
