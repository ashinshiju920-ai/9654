import type { Metadata } from "next";
import Script from "next/script";

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

const GTM_ID = "GTM-5KH82SXP";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        `}
      </Script>
      <body>
        <noscript>
          <iframe
            height="0"
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            style={{ display: "none", visibility: "hidden" }}
            width="0"
          />
        </noscript>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
