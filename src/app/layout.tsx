import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";

import "./globals.css";

export const metadata: Metadata = {
  title: "Aylem Learning Student Portal",
  description: "Student portal for Aylem Learning course materials and mock tests.",
  icons: {
    icon: [
      {
        url: "/newlogo.PNG",
        type: "image/png",
      },
    ],
    shortcut: "/newlogo.PNG",
    apple: "/newlogo.PNG",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
