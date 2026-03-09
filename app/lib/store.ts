import { createClient } from "@supabase/supabase-js";

export type BookingStatus = "Scheduled" | "POB" | "Completed" | "Cancelled";
export type PaymentStatus = "Unpaid" | "Paid";

export type Booking = {
  id: string;
  passenger_name: string;
  passenger_phone?: string | null;
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  distance_miles?: number | null;
  fare?: number | null;
  notes?: string | null;
  status: BookingStatus;
  payment_status: PaymentStatus;
  created_at?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let bookingsCache: Booking[] = [];
let hasLoaded = false;
let isLoading = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function compareBookings(a: Booking, b: Booking) {
  const aTime = new Date(a.pickup_datetime).getTime();
  const bTime = new Date(b.pickup_datetime).getTime();
  return aTime - bTime;
}

async function loadBookings() {
  if (isLoading) return;
  isLoading = true;

  try {
    const { data, error } = await supabase.from("bookings").select("*");

    if (error) {
      console.error("Error loading bookings:", error);
      return;
    }

    bookingsCache = Array.isArray(data)
      ? ([...data] as Booking[]).sort(compareBookings)
      : [];

    hasLoaded = true;
    emitChange();
  } catch (err) {
    console.error("Error loading bookings:", err);
  } finally {
    isLoading = false;
  }
}

export function getBookings(): Booking[] {
  if (!hasLoaded && !isLoading) {
    void loadBookings();
  }
  return bookingsCache;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!hasLoaded && !isLoading) {
    void loadBookings();
  }

  if (!pollTimer) {
    pollTimer = setInterval(() => {
      void loadBookings();
    }, 3000);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

export async function updateBooking(
  id: string,
  updates: Partial<Pick<Booking, "status" | "payment_status">>
) {
  const { error } = await supabase.from("bookings").update(updates).eq("id", id);

  if (error) {
    console.error("Error updating booking:", error);
    return;
  }

  await loadBookings();
}