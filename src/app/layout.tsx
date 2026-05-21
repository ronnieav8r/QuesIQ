import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "QuesIQ Interview",
  description: "Voice-first AI interview practice with Que.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
