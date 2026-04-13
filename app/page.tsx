"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">
          My Way Cars
        </h1>

        <p className="text-lg text-gray-600">
          Operator Dashboard
        </p>

        <Link
          href="/dashboard"
          className="inline-block rounded-xl bg-black px-6 py-3 text-white font-medium hover:bg-gray-800 transition"
        >
          Login
        </Link>
      </div>
    </main>
  );
}
