"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import {
  DEFAULT_BUSINESS_NAME,
  loadBusinessName,
} from "@/lib/businessBranding";

type Booking = {
  id: string;
  passenger_name?: string | null;
  pickup?: string | null;
  dropoff?: string | null;
  booking_type?: string | null;
  vehicle?: string | null;
  pickup_datetime?: string | null;
  payment_status?: string | null;
  fare?: number | null;
  status?: string | null;
  driver_assignment_status?: string | null;
  details_visible?: boolean;
  can_mark_on_my_way?: boolean;
  operator_phone?: string | null;
  passengers?: number | null;
  bags_large?: number | null;
  bags_small?: number | null;
};

type Driver = {
  id: string;
  name: string;
  email: string;
  is_active?: boolean | null;
  active?: boolean | null;
};

type DriverBookingAction =
  | "accept"
  | "decline"
  | "on_my_way"
  | "pob"
  | "complete_paid"
  | "complete_unpaid";

export default function DriverDashboardPage() {
  const supabase = getSupabase();
  const router = useRouter();

  const [email, setEmail] = useState("Loading...");
  const [status, setStatus] = useState("Checking...");
  const [driverName, setDriverName] = useState("");
  const [businessName, setBusinessName] = useState(DEFAULT_BUSINESS_NAME);
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [expandedJobIds, setExpandedJobIds] = useState<string[]>([]);
  const [showPastJobs, setShowPastJobs] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [jobsError, setJobsError] = useState("");
  const [noticesUnavailable, setNoticesUnavailable] = useState(false);
  const refreshId = useRef(0);

  const refreshAssignedJobs = useCallback(async () => {
    const requestId = ++refreshId.current;
    const withNotices = await supabase.rpc("driver_dashboard_jobs_with_cancellations");
    if (requestId !== refreshId.current) return;

    // Keep active jobs available if the cancellation feed fails.
    const { data, error } = withNotices.error
      ? await supabase.rpc("driver_dashboard_jobs")
      : withNotices;
    if (requestId !== refreshId.current) return;

    setJobs(error ? [] : (data as Booking[] | null) ?? []);
    setJobsError(error ? "Could not load jobs. Refresh to try again." : "");
    setNoticesUnavailable(!error && Boolean(withNotices.error));
    setNowMs(Date.now());
  }, [supabase]);

  useEffect(() => {
    let active = true;
    let jobPollTimer: number | undefined;

    async function loadDriver() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;

      if (!user || !user.email) {
        router.push("/driver-login");
        return;
      }

      const { data: driverData } = await supabase
        .from("drivers")
        .select("*")
        .eq("email", user.email)
        .single();
      if (!active) return;

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
      const name = await loadBusinessName(supabase, "Your operator");
      if (!active) return;
      setBusinessName(name);

      await refreshAssignedJobs();
      if (!active) return;
      // Driver accounts use the limited jobs function for every refresh.
      jobPollTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") void refreshAssignedJobs();
      }, 5000);
    }

    void loadDriver();

    return () => {
      active = false;
      refreshId.current++;
      window.clearInterval(jobPollTimer);
    };
  }, [refreshAssignedJobs, router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/driver-login");
    router.refresh();
  }

  async function runDriverBookingAction(
    jobId: string,
    action: DriverBookingAction,
    declineReason: string | null = null
  ) {
    const { error } = await supabase.rpc("driver_booking_action", {
      requested_booking_id: jobId,
      requested_action: action,
      requested_decline_reason: declineReason,
    });

    return error;
  }

  async function markPassengerOnBoard(jobId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to mark this job POB?"
    );

    if (!confirmed) return;

    const error = await runDriverBookingAction(jobId, "pob");

    if (error) {
      alert("Failed to update booking status");
      return;
    }

    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId ? { ...job, status: "POB" } : job
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

    const error = await runDriverBookingAction(
      jobId,
      response === "Accepted" ? "accept" : "decline",
      declineReason
    );

    if (error) {
      window.alert(`Could not send your response: ${error.message}`);
      return;
    }

    if (response === "Declined") {
      setJobs((current) => current.filter((job) => job.id !== jobId));
      window.alert("Job declined. The operator has been notified.");
    } else {
      setExpandedJobIds((current) =>
        current.filter((currentId) => currentId !== jobId)
      );
      window.alert("Job accepted.");
    }
    await refreshAssignedJobs();
  }

  async function completeJob(job: Booking, paid: boolean) {
    const alreadyPaid = job.payment_status === "Paid";
    const confirmed = window.confirm(
      alreadyPaid
        ? "Complete this job?"
        : paid
          ? "Complete this job and mark it paid?"
          : "Complete this job and leave it unpaid?"
    );
    if (!confirmed) return;

    const error = await runDriverBookingAction(
      job.id,
      paid || alreadyPaid ? "complete_paid" : "complete_unpaid"
    );

    if (error) {
      window.alert(`Could not complete the job: ${error.message}`);
      return;
    }

    setJobs((current) => current.filter((currentJob) => currentJob.id !== job.id));
    window.alert("Job completed. The operator dashboard has been updated.");
  }

  function openMap(address: string) {
    const encoded = encodeURIComponent(address);

    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      "_blank"
    );
  }

  async function markOnMyWay(jobId: string) {
    const error = await runDriverBookingAction(jobId, "on_my_way");
    if (error) {
      window.alert(`Could not update the journey status: ${error.message}`);
      return;
    }
    await refreshAssignedJobs();
  }

  function toggleJob(jobId: string) {
    setExpandedJobIds((current) =>
      current.includes(jobId)
        ? current.filter((currentId) => currentId !== jobId)
        : [...current, jobId]
    );
  }

  const cancelledJobs = jobs.filter((job) => job.status === "Cancelled");
  const offers = jobs.filter(
    (job) => job.status !== "Cancelled" && job.driver_assignment_status === "Awaiting response"
  );
  const confirmedJobs = jobs.filter(
    (job) => job.status !== "Cancelled" && job.driver_assignment_status !== "Awaiting response"
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
    const detailsVisible = job.details_visible === true;
    const canShowRoute = options.offer || typeof job.details_visible === "boolean";
    const passenger = options.offer
      ? "Journey offer"
      : detailsVisible ? job.passenger_name ?? "Passenger" : "Accepted job";
    const addressFallback = detailsVisible ? "Not set" : "Area unavailable";
    const pickup = (canShowRoute ? job.pickup : null) ?? addressFallback;
    const dropoff = (canShowRoute ? job.dropoff : null) ?? addressFallback;
    const bookingType = job.booking_type ?? "Not set";
    const vehicle = job.vehicle ?? "Not assigned";
    const alreadyPaid = job.payment_status === "Paid";
    const fare = typeof job.fare === "number" ? `£${job.fare.toFixed(2)}` : "Not set";
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
              <p><strong>Vehicle:</strong> {vehicle}</p>
              <p><strong>Customer fare:</strong> {fare}</p>
              {options.offer ? (
                <>
                  <p><strong>Passengers:</strong> {job.passengers ?? "Unknown"}</p>
                  <p><strong>Large bags:</strong> {job.bags_large ?? "Unknown"}</p>
                  <p><strong>Small bags:</strong> {job.bags_small ?? "Unknown"}</p>
                </>
              ) : (
                <>
                  <p><strong>Type:</strong> {bookingType}</p>
                  <p><strong>Payment:</strong> {job.payment_status ?? "Unknown"}</p>
                  <p><strong>Status:</strong> {job.status ?? "Unknown"}</p>
                </>
              )}
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
                {!detailsVisible && (
                  <p className="mt-3 text-sm text-slate-600">
                    {!job.pickup_datetime
                      ? "Contact the operator to confirm the pickup time."
                      : job.can_mark_on_my_way
                        ? "Tap On My Way when you leave to see the passenger name and exact addresses."
                        : "On My Way opens one hour before pickup. The passenger name and exact addresses are shown after you tap it."}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {detailsVisible ? (
                    <>
                      {job.status !== "POB" && (
                        <button
                          onClick={() => void markPassengerOnBoard(job.id)}
                          className="rounded-lg bg-blue-600 px-3 py-3 text-sm font-semibold text-white"
                        >
                          POB
                        </button>
                      )}
                      {job.pickup && (
                        <button
                          onClick={() => openMap(pickup)}
                          className="rounded-lg bg-slate-700 px-3 py-3 text-sm font-semibold text-white"
                        >
                          Pickup Map
                        </button>
                      )}
                      {job.dropoff && (
                        <button
                          onClick={() => openMap(dropoff)}
                          className="rounded-lg bg-slate-900 px-3 py-3 text-sm font-semibold text-white"
                        >
                          Dropoff Map
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => void markOnMyWay(job.id)}
                      disabled={!job.can_mark_on_my_way}
                      className="rounded-lg bg-indigo-600 px-3 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      On My Way
                    </button>
                  )}
                  {!alreadyPaid && (
                    <button
                      onClick={() => void completeJob(job, false)}
                      className="rounded-lg bg-emerald-700 px-3 py-3 text-sm font-semibold text-white"
                    >
                      Complete Unpaid
                    </button>
                  )}
                  <button
                    onClick={() => void completeJob(job, true)}
                    className="rounded-lg bg-blue-700 px-3 py-3 text-sm font-semibold text-white"
                  >
                    {alreadyPaid ? "Complete Job" : "Complete & Paid"}
                  </button>
                </div>
              </>
            )}
            {!options.offer && job.operator_phone && (
              <a
                href={`tel:${job.operator_phone}`}
                className="mt-3 block rounded-lg bg-purple-600 px-3 py-3 text-center text-sm font-semibold text-white"
              >
                Call operator
              </a>
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
            <h1 className="text-xl font-bold">{businessName} Driver Dashboard</h1>
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

        {jobsError && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{jobsError}</p>
        )}
        {noticesUnavailable && (
          <p role="status" className="rounded-xl bg-amber-50 p-3 text-amber-900">
            Cancellation notices could not load. Your active jobs are shown below.
          </p>
        )}

        <div role="status">
          {cancelledJobs.length > 0 && (
            <section className="space-y-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-950">
              <h2 className="text-lg font-bold">Cancelled jobs ({cancelledJobs.length})</h2>
              <p className="text-sm font-semibold">Do not travel for these bookings.</p>
              <ul className="divide-y divide-red-200">
                {cancelledJobs.map((job) => (
                  <li key={job.id} className="py-2">
                    <p className="font-semibold">
                      {job.pickup_datetime
                        ? new Date(job.pickup_datetime).toLocaleString("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Pickup time unavailable"}
                    </p>
                    <p className="text-sm">
                      {job.pickup ?? "Pickup area unavailable"} → {job.dropoff ?? "Drop-off area unavailable"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {offers.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-800">
              Job offers ({offers.length})
            </h2>
            {offers.map((job) => renderJobCard(job, { offer: true }))}
          </section>
        ) : null}

        {!jobsError && (
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
        )}

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
