"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Review = {
  id: string;
  reviewer_name: string;
  reviewer_area: string | null;
  journey_type: string | null;
  rating: number;
  review_text: string;
  created_at: string;
};

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="tracking-wide text-[#6d2663]">
      {"\u2605\u2605\u2605\u2605\u2605".slice(0, rating)}
      <span className="text-[#ded7df]">{"\u2605\u2605\u2605\u2605\u2605".slice(rating)}</span>
    </span>
  );
}

function ReviewsContent() {
  const searchParams = useSearchParams();
  const businessSlug = searchParams.get("business") || "my-way-cars";
  const [businessName, setBusinessName] = useState("My Way Cars");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rating, setRating] = useState(5);

  const reviewCountLabel = useMemo(
    () => `${reviews.length} approved review${reviews.length === 1 ? "" : "s"}`,
    [reviews.length]
  );

  async function loadReviews() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/reviews?business=${encodeURIComponent(businessSlug)}`,
        { cache: "no-store" }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load reviews.");
      setBusinessName(payload.businessName || "My Way Cars");
      setReviews(payload.reviews || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReviews();
  }, [businessSlug]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSending(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessSlug,
          name: String(form.get("name") || ""),
          area: String(form.get("area") || ""),
          journeyType: String(form.get("journeyType") || ""),
          rating,
          review: String(form.get("review") || ""),
          website: String(form.get("website") || ""),
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not send review.");

      setMessage(
        payload.message ||
          "Thank you. Your review has been received and will appear after approval."
      );
      formElement.reset();
      setRating(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send review.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f4f7] px-4 py-8 text-[#25212a]">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="rounded-3xl bg-[#53204f] p-7 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ded7df]">
            Customer Reviews
          </p>
          <h1 className="mt-2 text-3xl font-bold">{businessName}</h1>
          <p className="mt-3 max-w-2xl text-[#f1eaf0]">
            Read genuine customer feedback or leave a review about your journey.
            New reviews are checked before they are published.
          </p>
        </header>

        <section className="rounded-3xl border border-[#dedce3] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Leave a review</h2>
          <p className="mt-1 text-sm text-[#696772]">
            Your review will be submitted for approval before appearing publicly.
          </p>

          <form onSubmit={submitReview} className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Name
                <input
                  name="name"
                  required
                  maxLength={80}
                  className="rounded-xl border border-[#c9c4cd] px-3 py-3"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Town / area
                <input
                  name="area"
                  maxLength={100}
                  className="rounded-xl border border-[#c9c4cd] px-3 py-3"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm font-medium">
              Journey type
              <select
                name="journeyType"
                className="rounded-xl border border-[#c9c4cd] px-3 py-3"
                defaultValue=""
              >
                <option value="">Choose if applicable</option>
                <option>Airport transfer</option>
                <option>Long-distance journey</option>
                <option>Local journey</option>
                <option>Other</option>
              </select>
            </label>

            <fieldset>
              <legend className="text-sm font-medium">Rating</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    aria-pressed={rating === value}
                    className={`rounded-xl border px-4 py-2 ${
                      rating === value
                        ? "border-[#53204f] bg-[#53204f] text-white"
                        : "border-[#c9c4cd] bg-white"
                    }`}
                  >
                    {value} {"\u2605"}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-1 text-sm font-medium">
              Your review
              <textarea
                name="review"
                required
                maxLength={1200}
                rows={5}
                className="rounded-xl border border-[#c9c4cd] px-3 py-3"
              />
            </label>

            <label className="hidden" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>

            {message && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="rounded-xl bg-[#53204f] px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {sending ? "Sending..." : "Submit review"}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold">What customers say</h2>
            <p className="text-sm text-[#696772]">{reviewCountLabel}</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-[#dedce3] bg-white p-5">
              Loading reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-[#dedce3] bg-white p-6 text-[#25212a]">
              No approved reviews yet. Be the first to leave one.
            </div>
          ) : (
            reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-[#dedce3] border-l-4 border-l-[#6d2663] bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{review.reviewer_name}</h3>
                    <p className="text-sm text-[#696772]">
                      {[review.reviewer_area, review.journey_type]
                        .filter(Boolean)
                        .join(" Â· ")}
                    </p>
                  </div>
                  <Stars rating={review.rating} />
                </div>
                <p className="mt-4 whitespace-pre-wrap leading-7 text-[#25212a]">
                  {review.review_text}
                </p>
                <p className="mt-3 text-xs text-[#9196ae]">
                  {new Intl.DateTimeFormat("en-GB", {
                    month: "short",
                    year: "numeric",
                  }).format(new Date(review.created_at))}
                </p>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f5f4f7] px-4 py-8 text-[#25212a]">
          <div className="mx-auto max-w-4xl rounded-2xl border border-[#dedce3] bg-white p-6">
            Loading customer reviews...
          </div>
        </main>
      }
    >
      <ReviewsContent />
    </Suspense>
  );
}