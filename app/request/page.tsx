import { Suspense as CustomerInstallSuspense } from "react";
import CustomerPhoneInstall from "./CustomerPhoneInstall";
import type { Metadata } from "next";
import BookingRequestClient from "./BookingRequestClient";

type SearchParams = { [key: string]: string | string[] | undefined };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const query = await searchParams;
  const business = Array.isArray(query.business) ? query.business[0] : query.business;

  if (business?.trim() !== "my-way-cars") return {};

  const assets = "/customer-app/my-way-cars";
  return {
    title: "Book a journey | My Way Cars",
    description: "Request a pre-booked journey with My Way Cars.",
    applicationName: "My Way Cars",
    manifest: `${assets}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: "My Way Cars",
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        { url: `${assets}/icon-192.png`, sizes: "192x192", type: "image/png" },
        { url: `${assets}/icon-512.png`, sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: `${assets}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
    },
  };
}

export default function BookingRequestPage() {
  return (
    <>
      <CustomerInstallSuspense fallback={null}>
        <CustomerPhoneInstall />
      </CustomerInstallSuspense>
      <BookingRequestClient />
    </>
  );
}
