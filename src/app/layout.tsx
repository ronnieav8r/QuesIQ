import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "QuesIQ Interview",
  description: "Voice-first AI interview practice with Que.",
  icons: {
    apple: "/brand/quesiq-icon.png",
    icon: "/brand/quesiq-icon.png",
  },
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
