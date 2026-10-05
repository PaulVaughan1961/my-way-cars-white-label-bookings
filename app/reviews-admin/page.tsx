"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type Review = {
  id: string;
  reviewer_name: string;
  reviewer_area: string | null;
  journey_type: string | null;
  rating: number;
  review_text: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function ReviewsAdminPage() {
  const supabase = getSupabase();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function token() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/operator-login?next=/reviews-admin";
      return "";
    }
    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const accessToken = await token();
      if (!accessToken) return;
      const response = await fetch("/api/reviews/moderate", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load reviews.");
      setReviews(payload.reviews || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function moderate(id: string, action: "approve" | "reject") {
    if (busyId) return;
    setBusyId(id);
    setError("");
    try {
      const accessToken = await token();
      if (!accessToken) return;
      const response = await fetch("/api/reviews/moderate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update review.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update review.");
    } finally {
      setBusyId("");
    }
  }

  const pending = reviews.filter((review) => review.status === "pending");
  const previous = reviews.filter((review) => review.status !== "pending");

  return (
    <main className="min-h-screen bg-[#f5f4f7] px-4 py-8 text-[#25212a]">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-[#53204f]">Customer Reviews</h1>
            <p className="mt-1 text-[#696772]">
              Approve genuine reviews before they appear publicly.
            </p>
          </div>
          <a
            href="/dashboard"
            className="rounded-xl border border-[#53204f] bg-white px-4 py-2 font-medium text-[#53204f]"
          >
            Back to dashboard
          </a>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">Loading reviews...</div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-[#53204f]">Pending ({pending.length})</h2>
              {pending.length === 0 ? (
                <div className="rounded-2xl border border-[#dedce3] bg-white p-5 text-[#696772]">
                  No reviews are waiting for approval.
                </div>
              ) : (
                pending.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-2xl border border-[#dedce3] bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{review.reviewer_name}</h3>
                        <p className="text-sm text-[#696772]">
                          {[review.reviewer_area, review.journey_type]
                            .filter(Boolean)
                            .join(" Â· ")}
                        </p>
                      </div>
                      <div className="font-semibold">{review.rating} / 5 {"\u2605"}</div>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-[#25212a]">
                      {review.review_text}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        disabled={busyId === review.id}
                        onClick={() => void moderate(review.id, "approve")}
                        className="rounded-xl bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busyId === review.id}
                        onClick={() => void moderate(review.id, "reject")}
                        className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#53204f]">Previous decisions</h2>
              {previous.slice(0, 50).map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-[#dedce3] bg-white p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{review.reviewer_name}</span>
                    <span className="text-sm capitalize text-[#696772]">
                      {review.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-[#696772]">
                    {review.review_text}
                  </p>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}