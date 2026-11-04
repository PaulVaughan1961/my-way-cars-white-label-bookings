import { passengerInfo } from "@/lib/passengerCount";

export default function PassengerCount({ value, journey }: { value: unknown; journey?: string }) {
  const info = passengerInfo(value);
  const colours = info.requiresLargerVehicle ? "border-red-600 bg-red-50 text-red-950"
    : info.count === null ? "border-amber-300 bg-amber-50 text-amber-950"
    : "border-slate-200 bg-slate-100 text-slate-700";
  const layout = info.requiresLargerVehicle
    ? "flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 px-3 py-2"
    : "inline-flex max-w-full flex-wrap items-center gap-x-1 rounded-full border px-2 py-0.5 text-xs font-semibold";
  const advice = info.requiresLargerVehicle ? "Check capacity: minibus, larger vehicle or two vehicles."
    : info.count === null ? "Confirm the passenger count before quoting." : "";
  return <span title={[info.label, advice].filter(Boolean).join(". ")} className={`${layout} ${colours}`}>
    <span className={info.requiresLargerVehicle ? "text-lg font-bold" : undefined}>{journey ? `${journey}: ` : ""}{info.label}</span>
    {info.requiresLargerVehicle && <span className="text-sm font-extrabold">CHECK CAPACITY: MINIBUS / LARGER VEHICLE OR TWO VEHICLES</span>}
    {info.count === null && <span>· Confirm count</span>}
  </span>;
}
