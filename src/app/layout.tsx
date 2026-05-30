import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "QuesIQ | AI Practice Platform",
  description:
    "AI-powered practice for interviews, studying, and pilot oral exam preparation.",
  icons: {
    apple: "/brand/quesiq-icon.png",
    icon: "/brand/quesiq-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#080d1c",
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
