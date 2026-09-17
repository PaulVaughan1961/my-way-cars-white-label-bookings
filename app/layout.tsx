import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booking Management",
  description: "Booking management for taxi and private-hire operators",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
