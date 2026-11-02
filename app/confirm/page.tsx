import type { Metadata } from "next";
import ConfirmationClient from "./ConfirmationClient";

export const metadata: Metadata = {
  title: "Review your journey", robots: { index: false, follow: false }, referrer: "no-referrer",
};
export default function ConfirmationPage() { return <ConfirmationClient />; }
