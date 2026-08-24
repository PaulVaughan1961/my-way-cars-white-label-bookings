import Link from "next/link";

export default function BusinessSetupPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Business setup
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage the information used when bookings and invoices are
                created.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl bg-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-900"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/accounts"
            className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm transition hover:border-blue-400"
          >
            <div className="text-xl font-bold text-slate-900">Accounts</div>
            <p className="mt-2 text-sm text-slate-600">
              Add and update account names, billing addresses, contacts and
              invoice email addresses.
            </p>
            <div className="mt-4 font-medium text-blue-700">
              Manage accounts →
            </div>
          </Link>

          <div className="rounded-3xl border border-slate-200 bg-slate-100 p-6 shadow-sm">
            <div className="text-xl font-bold text-slate-700">Drivers</div>
            <p className="mt-2 text-sm text-slate-600">
              Driver and vehicle setup will be added in the next update.
            </p>
            <div className="mt-4 text-sm font-medium text-slate-500">
              Coming next
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
