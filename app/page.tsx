import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">My Way Cars</h1>
        <p className="mt-4 text-lg text-gray-600">Operator Dashboard</p>

        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-xl bg-black px-6 py-3 text-white hover:bg-gray-800"
        >
          Login
        </Link>
      </div>
    </main>
  );
}
