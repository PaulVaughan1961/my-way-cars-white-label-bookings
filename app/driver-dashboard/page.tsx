"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

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
  driver_assignment_status?: string | null;
  driver_response_at?: string | null;
  driver_decline_reason?: string | null;
};

type Driver = {
  id: string;
  name: string;
  email: string;
  is_active?: boolean | null;
  active?: boolean | null;
};

export default function DriverDashboardPage() {
  const supabase = getSupabase();
  const router = useRouter();

  const [email, setEmail] = useState("Loading...");
  const [status, setStatus] = useState("Checking...");
  const [driverName, setDriverName] = useState("");
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [expandedJobIds, setExpandedJobIds] = useState<string[]>([]);
  const [showPastJobs, setShowPastJobs] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    let bookingChannel: ReturnType<typeof supabase.channel> | null = null;
    let jobPollTimer: number | null = null;

    async function refreshAssignedJobs(name: string) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("driver_name", name)
        .neq("status", "Completed")
        .order("pickup_datetime", { ascending: true });

      const hiddenStatuses = new Set(["Completed", "Cancelled", "Rejected"]);
      const visibleJobs = ((bookings as Booking[]) || []).filter((booking) => {
        const bookingStatus = (booking.status ?? "Scheduled").toString();
        return (
          booking.driver_assignment_status !== "Declined" &&
          !hiddenStatuses.has(bookingStatus)
        );
      });

      // Job offers always take priority over the confirmed journey list.
      visibleJobs.sort((a, b) => {
        const aOffer = a.driver_assignment_status === "Awaiting response";
        const bOffer = b.driver_assignment_status === "Awaiting response";
        if (aOffer !== bOffer) return aOffer ? -1 : 1;

        const aTime = a.pickup_datetime
          ? new Date(a.pickup_datetime).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.pickup_datetime
          ? new Date(b.pickup_datetime).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });

      setJobs(visibleJobs);
      setNowMs(Date.now());
    }

    async function loadDriver() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.email) {
        router.push("/driver-login");
        return;
      }

const { data: driverData } = await supabase
  .from("drivers")
  .select("*")
  .eq("email", user.email)
  .single();

const driver = driverData as Driver | null;

      if (
        !driver ||
        driver.is_active === false ||
        driver.active === false
      ) {
        await supabase.auth.signOut();
        router.push("/driver-login");
        return;
      }

      setEmail(user.email);
      setDriverName(driver.name);
      setStatus("Access confirmed");

      await refreshAssignedJobs(driver.name);
      bookingChannel = supabase
        .channel(`driver-bookings-${driver.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookings",
          },
          () => {
            void refreshAssignedJobs(driver.name);
          }
        )
        .subscribe();

      // Reliable fallback when database Realtime replication is unavailable.
      jobPollTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          void refreshAssignedJobs(driver.name);
        }
      }, 5000);
    }

    void loadDriver();

    return () => {
      if (jobPollTimer !== null) {
        window.clearInterval(jobPollTimer);
      }
      if (bookingChannel) {
        void supabase.removeChannel(bookingChannel);
      }
    };
  }, [router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/driver-login");
    router.refresh();
  }

  async function updatePaymentStatus(
    jobId: string,
    paymentStatus: string
  ) {
    const confirmed = window.confirm(
      `Are you sure you want to mark this job as ${paymentStatus}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("bookings")
  .update({ payment_status: paymentStatus } as never)
      .eq("id", jobId);

    if (error) {
      alert("Failed to update payment status");
      return;
    }

    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId
          ? { ...job, payment_status: paymentStatus }
          : job
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
   .update({ status: newStatus } as never)
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

  async function respondToAssignment(
    jobId: string,
    response: "Accepted" | "Declined"
  ) {
    let declineReason: string | null = null;
    if (response === "Declined") {
      const entered = window.prompt(
        "Please give the operator a brief reason:",
        "I am not available for this journey."
      );
      if (entered === null) return;
      declineReason = entered.trim() || "No reason supplied";
    }

    const confirmed = window.confirm(
      response === "Accepted"
        ? "Accept this job?"
        : "Decline this job and return it to the operator?"
    );
    if (!confirmed) return;

    const patch = {
      driver_assignment_status: response,
      driver_response_at: new Date().toISOString(),
      driver_decline_reason: declineReason,
    };
    const { error } = await supabase
      .from("bookings")
      .update(patch as never)
      .eq("id", jobId);

    if (error) {
      window.alert(`Could not send your response: ${error.message}`);
      return;
    }

    if (response === "Declined") {
      setJobs((current) => current.filter((job) => job.id !== jobId));
      window.alert("Job declined. The operator has been notified.");
    } else {
      setJobs((current) =>
        current.map((job) =>
          job.id === jobId ? { ...job, ...patch } : job
        )
      );
      setExpandedJobIds((current) =>
        current.filter((currentId) => currentId !== jobId)
      );
      window.alert("Job accepted. It is now in your confirmed job list.");
    }
  }

  async function completeJob(jobId: string, paid: boolean) {
    const confirmed = window.confirm(
      paid
        ? "Complete this job and mark it paid?"
        : "Complete this job and leave it unpaid?"
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("bookings")
      .update({
        status: "Completed",
        payment_status: paid ? "Paid" : "Unpaid",
      } as never)
      .eq("id", jobId);

    if (error) {
      window.alert(`Could not complete the job: ${error.message}`);
      return;
    }

    setJobs((current) => current.filter((job) => job.id !== jobId));
    window.alert("Job completed. The operator dashboard has been updated.");
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

    const firstName = passenger?.split(" ")[0] || "Customer";
    const driverFirstName =
      currentDriverName?.split(" ")[0] || "Driver";

    const message = `Hello ${firstName}, this is ${driverFirstName}, I'm your My Way Cars driver. I just wanted to inform you that I am on my way to ${pickup} and will see you soon.

Regards
${driverFirstName}`;

    const encodedMessage = encodeURIComponent(message);

    window.open(`sms:${phone}?body=${encodedMessage}`, "_blank");
  }

  function markOnMyWay(
    jobId: string,
    phone: string,
    passenger: string,
    pickup: string
  ) {
    // Open the phone's message composer immediately.  On iPhone/iPad, doing
    // this after an awaited database call can cause Safari to block it.
    textCustomer(phone, passenger, driverName, pickup);

    // The text is for the customer; the saved status is for the operator.
    // Both need to happen when the driver presses "On My Way".
    void (async () => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "On My Way" } as never)
        .eq("id", jobId);

      if (error) {
        window.alert(
          "The customer message was opened, but the operator dashboard could not be updated."
        );
        return;
      }

      setJobs((current) =>
        current.map((job) =>
          job.id === jobId ? { ...job, status: "On My Way" } : job
        )
      );
    })();
  }

  function callCustomer(phone: string) {
    if (!phone) {
      alert("No customer phone number found");
      return;
    }

    window.open(`tel:${phone}`, "_self");
  }

  function toggleJob(jobId: string) {
    setExpandedJobIds((current) =>
      current.includes(jobId)
        ? current.filter((currentId) => currentId !== jobId)
        : [...current, jobId]
    );
  }

  const offers = jobs.filter(
    (job) => job.driver_assignment_status === "Awaiting response"
  );
  const confirmedJobs = jobs.filter(
    (job) => job.driver_assignment_status !== "Awaiting response"
  );
  const pastCutoff = nowMs - 12 * 60 * 60 * 1000;
  const pastJobs = confirmedJobs.filter((job) => {
    if ((job.status ?? "Scheduled").toString() === "POB") return false;
    if (!job.pickup_datetime || nowMs === 0) return false;
    const pickupMs = new Date(job.pickup_datetime).getTime();
    return !Number.isNaN(pickupMs) && pickupMs < pastCutoff;
  });
  const upcomingJobs = confirmedJobs.filter(
    (job) => !pastJobs.some((pastJob) => pastJob.id === job.id)
  );

  function renderJobCard(
    job: Booking,
    options: { offer?: boolean; next?: boolean; past?: boolean } = {}
  ) {
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
      ? new Date(rawDateTime).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "No date";
    const time = rawDateTime
      ? new Date(rawDateTime).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "No time";
    const isExpanded = options.offer || expandedJobIds.includes(job.id);

    return (
      <div
        key={job.id}
        className={`overflow-hidden rounded-2xl border shadow-sm ${
          options.offer
            ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
            : options.next
            ? "border-green-400 bg-green-50"
            : options.past
            ? "border-slate-300 bg-slate-50"
            : "border-slate-200 bg-white"
        }`}
      >
        {options.offer ? (
          <div className="bg-amber-500 px-4 py-3 text-center text-base font-black text-slate-950">
            NEW JOB OFFER — PLEASE RESPOND
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => toggleJob(job.id)}
          className="w-full p-4 text-left"
          aria-expanded={isExpanded}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {options.next ? (
                  <span className="rounded-full bg-green-700 px-2 py-1 text-xs font-bold text-white">
                    NEXT JOB
                  </span>
                ) : null}
                {options.past ? (
                  <span className="rounded-full bg-slate-600 px-2 py-1 text-xs font-bold text-white">
                    PAST
                  </span>
                ) : null}
                <span className="font-bold text-slate-950">{passenger}</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-700">
                {date} at {time}
              </div>
            </div>
            {!options.offer ? (
              <span className="shrink-0 text-sm font-semibold text-slate-500">
                {isExpanded ? "Close ▲" : "Open ▼"}
              </span>
            ) : null}
          </div>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <div className="truncate"><strong>From:</strong> {pickup}</div>
            <div className="truncate"><strong>To:</strong> {dropoff}</div>
          </div>
        </button>

        {isExpanded ? (
          <div className="border-t border-slate-200 px-4 pb-4 pt-3">
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <p><strong>Type:</strong> {bookingType}</p>
              <p><strong>Vehicle:</strong> {vehicle}</p>
              <p><strong>Payment:</strong> {job.payment_status ?? "Unknown"}</p>
              <p><strong>Status:</strong> {job.status ?? "Unknown"}</p>
            </div>

            {options.offer ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={() => void respondToAssignment(job.id, "Accepted")}
                  className="rounded-xl bg-green-700 px-5 py-4 text-lg font-bold text-white shadow"
                >
                  ACCEPT JOB
                </button>
                <button
                  onClick={() => void respondToAssignment(job.id, "Declined")}
                  className="rounded-xl bg-red-700 px-5 py-4 text-lg font-bold text-white shadow"
                >
                  CANNOT DO IT
                </button>
              </div>
            ) : (
              <>
                {job.driver_assignment_status === "Accepted" ? (
                  <div className="mt-3 rounded-xl border border-green-400 bg-green-50 p-3 font-bold text-green-800">
                    JOB ACCEPTED
                  </div>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    onClick={() => updateJobStatus(job.id, "POB")}
                    className="rounded-lg bg-blue-600 px-3 py-3 text-sm font-semibold text-white"
                  >
                    POB
                  </button>
                  <button
                    onClick={() =>
                      markOnMyWay(
                        job.id,
                        job.passenger_phone ?? "",
                        passenger,
                        pickup
                      )
                    }
                    className="rounded-lg bg-indigo-600 px-3 py-3 text-sm font-semibold text-white"
                  >
                    On My Way
                  </button>
                  <button
                    onClick={() => callCustomer(job.passenger_phone ?? "")}
                    className="rounded-lg bg-purple-600 px-3 py-3 text-sm font-semibold text-white"
                  >
                    Call
                  </button>
                  <button
                    onClick={() => openMap(pickup)}
                    className="rounded-lg bg-slate-700 px-3 py-3 text-sm font-semibold text-white"
                  >
                    Pickup Map
                  </button>
                  <button
                    onClick={() => openMap(dropoff)}
                    className="rounded-lg bg-slate-900 px-3 py-3 text-sm font-semibold text-white"
                  >
                    Dropoff Map
                  </button>
                  <button
                    onClick={() => updateJobStatus(job.id, "Scheduled")}
                    className="rounded-lg bg-slate-500 px-3 py-3 text-sm font-semibold text-white"
                  >
                    Reset Status
                  </button>
                  <button
                    onClick={() => void completeJob(job.id, false)}
                    className="rounded-lg bg-emerald-700 px-3 py-3 text-sm font-semibold text-white"
                  >
                    Complete Unpaid
                  </button>
                  <button
                    onClick={() => void completeJob(job.id, true)}
                    className="rounded-lg bg-blue-700 px-3 py-3 text-sm font-semibold text-white"
                  >
                    Complete & Paid
                  </button>
                  <button
                    onClick={() => updatePaymentStatus(job.id, "Paid")}
                    className="rounded-lg bg-green-600 px-3 py-3 text-sm font-semibold text-white"
                  >
                    Mark Paid
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center justify-between gap-4 rounded-2xl bg-slate-950 p-4 text-white shadow-sm">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Driver Dashboard</h1>
            <p className="truncate text-sm text-slate-300">{driverName || email}</p>
            <p className="mt-1 text-xs font-semibold text-green-300">● {status}</p>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold"
          >
            Logout
          </button>
        </header>

        {offers.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-800">
              Job offers ({offers.length})
            </h2>
            {offers.map((job) => renderJobCard(job, { offer: true }))}
          </section>
        ) : null}

        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-950">Upcoming jobs</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
              {upcomingJobs.length}
            </span>
          </div>
          {upcomingJobs.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-500">
              No upcoming confirmed jobs
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingJobs.map((job, index) =>
                renderJobCard(job, { next: index === 0 })
              )}
            </div>
          )}
        </section>

        {pastJobs.length > 0 ? (
          <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setShowPastJobs((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <h2 className="font-bold text-slate-900">
                  Past jobs needing attention ({pastJobs.length})
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  These records have not been marked completed.
                </p>
              </div>
              <span className="shrink-0 font-bold text-slate-600">
                {showPastJobs ? "Hide ▲" : "Show ▼"}
              </span>
            </button>
            {showPastJobs ? (
              <div className="mt-4 space-y-3">
                {pastJobs.map((job) => renderJobCard(job, { past: true }))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
