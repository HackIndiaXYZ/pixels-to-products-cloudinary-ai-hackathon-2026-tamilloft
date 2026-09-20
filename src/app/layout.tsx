import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echo — AI visibility auditor",
  description:
    "Measure whether AI models recommend your brand when buyers ask what to buy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
