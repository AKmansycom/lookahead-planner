import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LookAhead · Mini Look-Ahead Planning",
  description: "Weekly look-ahead planning for construction site engineers",
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
