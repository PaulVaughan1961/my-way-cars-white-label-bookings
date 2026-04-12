"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Booking = {
  id: string;
  passenger_name?: string | null;
  lead_passenger?: string | null;
  booker_name?: string | null;
  passenger_phone?: string | null;
  outbound_pickup?: string | null;
  pickup?: string | null;
  from_address?: string | null;
  pickup_address?: string | null;
  outbound_dropoff?: string | null;
  dropoff?: string | null;
  to_address?: string | null;
  dropoff_address?: string | null;
  booking_type?: string | null;
  type?: string | null;
  vehicle?: string | null;
  pickup_datetime?: string | null;
  payment_status?: string | null;
  status?: string | null;
};

type Driver = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
};

export default function DriverDashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState<string>("Loading...");
  const [status, setStatus] = useState<string>("Checking...");
  const [driverName, setDriverName] = useState<string>("");
  const [jobs, setJobs] = useState<Booking[]>([]);

  useEffect(() => {
    async function loadDriver() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.email) {
        router.push("/driver-login");
        return;
      }

      const { data: driver } = await supabase
        .from("drivers")
        .select("*")
        .eq("email", user.email)
        .single<Driver>();

      if (!driver || !driver.is_active) {
        await supabase.auth.signOut();
        router.push("/driver-login");
        return;
      }

      setEmail(user.email);
      setDriverName(driver.name);
      setStatus("Access confirmed");

const { data: bookings } = await supabase
  .from("bookings")
  .select("*")
  .eq("driver_name", driver.name)
  .neq("status", "Completed")
  .order("pickup_datetime", { ascending: true });

      setJobs((bookings as Booking[]) || []);
    }

    loadDriver();
  }, [router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/driver-login");
    router.refresh();
  }

  async function updatePaymentStatus(jobId: string, paymentStatus: string) {
    const confirmed = window.confirm(
      `Are you sure you want to mark this job as ${paymentStatus}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("bookings")
      .update({ payment_status: paymentStatus })
      .eq("id", jobId);

    if (error) {
      alert("Failed to update payment status");
      return;
    }

    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId ? { ...job, payment_status: paymentStatus } : job
      )
    );
  }

  async function updateJobStatus(jobId: string, newStatus: string) {
    const confirmed = window.confirm(
      `Are you sure you want to change this job status to ${newStatus}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", jobId);

    if (error) {
      alert("Failed to update booking status");
      return;
    }

    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId ? { ...job, status: newStatus } : job
      )
    );
  }

  function openMap(address: string) {
    const encoded = encodeURIComponent(address);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      "_blank"
    );
  }

  function textCustomer(
    phone: string,
    passenger: string,
    currentDriverName: string,
    pickup: string
  ) {
    if (!phone) {
      alert("No customer phone number found");
      return;
    }
    function callCustomer(phone: string) {
  if (!phone) {
    alert("No customer phone number found");
    return;
  }

  window.open(`tel:${phone}`, "_self");
}

    const firstName = passenger?.split(" ")[0] || "Customer";
    const driverFirstName = currentDriverName?.split(" ")[0] || "Driver";

    const message = `Hello ${firstName}, this is ${driverFirstName}, I'm your My Way Cars driver. I just wanted to inform you that I am on my way to ${pickup} and will see you soon.

Regards
${driverFirstName}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`sms:${phone}?body=${encodedMessage}`, "_blank");
  }

 function callCustomer(phone: string) {
  if (!phone) {
    alert("No customer phone number found");
    return;
  }

  window.open(`tel:${phone}`, "_self");
}

return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Driver Dashboard</h1>

          <p className="mt-2 text-sm text-slate-600">Status:</p>
          <p className="font-medium">{status}</p>

          <p className="mt-2 text-sm text-slate-600">Logged in as:</p>
          <p className="font-medium">{email}</p>

          <p className="mt-2 text-sm text-slate-600">Driver:</p>
          <p className="font-medium">{driverName}</p>

          <button
            onClick={handleLogout}
            className="mt-4 rounded-lg bg-black px-4 py-2 text-white"
          >
            Logout
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Your Jobs</h2>

          {jobs.length === 0 ? (
            <p className="text-slate-500">No jobs found</p>
          ) : (
            <div className="space-y-3">
              {jobs.map((job, index) => {
                const passenger =
                  job.passenger_name ??
                  job.lead_passenger ??
                  job.booker_name ??
                  "Unknown";

                const pickup =
                  job.outbound_pickup ??
                  job.pickup ??
                  job.from_address ??
                  job.pickup_address ??
                  "Not set";

                const dropoff =
                  job.outbound_dropoff ??
                  job.dropoff ??
                  job.to_address ??
                  job.dropoff_address ??
                  "Not set";

                const bookingType = job.booking_type ?? job.type ?? "Not set";

                const vehicle = job.vehicle ?? "Not assigned";

                const rawDateTime = job.pickup_datetime;

                const date = rawDateTime
                  ? new Date(rawDateTime).toLocaleDateString()
                  : "No date";

                const time = rawDateTime
                  ? new Date(rawDateTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "No time";

                return (
                  <div
                    key={job.id}
                    className={`border rounded-lg p-4 space-y-1 ${
                      index === 0
                        ? "bg-green-100 border-green-500 shadow-md"
                        : "bg-slate-50"
                    }`}
                  >
                    {index === 0 && (
                      <p className="mb-2 text-sm font-bold text-green-700">
                        NEXT JOB
                      </p>
                    )}

                    <p>
                      <strong>Passenger:</strong> {passenger}
                    </p>
                    <p>
                      <strong>Date:</strong> {date}
                    </p>
                    <p>
                      <strong>Time:</strong> {time}
                    </p>
                    <p>
                      <strong>Pickup:</strong> {pickup}
                    </p>
                    <p>
                      <strong>Dropoff:</strong> {dropoff}
                    </p>
                    <p>
                      <strong>Type:</strong> {bookingType}
                    </p>
                    <p>
                      <strong>Vehicle:</strong> {vehicle}
                    </p>
                    <p>
                      <strong>Payment:</strong>{" "}
                      {job.payment_status ?? "Unknown"}
                    </p>
                    <p>
                      <strong>Status:</strong> {job.status ?? "Unknown"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => updateJobStatus(job.id, "POB")}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                      >
                        POB
                      </button>

                      <button
                        onClick={() => updateJobStatus(job.id, "Scheduled")}
                        className="rounded-lg bg-gray-600 px-3 py-2 text-sm text-white"
                      >
                        Reset Status
                      </button>
                      

                      <button
                        onClick={() =>
                          textCustomer(
                            job.passenger_phone ?? "",
                            passenger,
                            driverName,
                            pickup
                          )
                        }
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
                      >
                        Text Customer
                      </button>
                      <button
  onClick={() => callCustomer(job.passenger_phone ?? "")}
  className="rounded-lg bg-purple-600 px-3 py-2 text-white text-sm"
>
  Call Customer
</button>

                      <button
                        onClick={() => updatePaymentStatus(job.id, "Paid")}
                        className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white"
                      >
                        Mark Paid
                      </button>

                      <button
                        onClick={() => updatePaymentStatus(job.id, "Unpaid")}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white"
                      >
                        Mark Unpaid
                      </button>

                      <button
                        onClick={() => openMap(pickup)}
                        className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white"
                      >
                        Pickup Map
                      </button>

                      <button
                        onClick={() => openMap(dropoff)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        Dropoff Map
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}