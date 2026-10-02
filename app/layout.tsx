import type { Metadata } from "next";
import "./globals.css";
import "./import.css";
import "./history.css";
import "./campaigns.css";
import "./research.css";

export const metadata: Metadata = {
  title: "Aayatra Sales Engine",
  description: "Aayatra Enterprises internal sales workspace",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
