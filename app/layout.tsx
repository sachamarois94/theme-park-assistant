import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ServiceWorkerRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: "Theme Park Assistant",
  description: "Live queue intelligence and day planning for Orlando Disney and Universal parks.",
  applicationName: "Theme Park Assistant",
  appleWebApp: {
    capable: true,
    title: "Theme Park Assistant",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    apple: [{ url: "/apple-touch-icon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="grain-overlay" />
        <Suspense
          fallback={(
            <div className="relative mx-auto min-h-screen max-w-6xl px-4 pb-10 pt-6 md:px-8">
              <main>{children}</main>
            </div>
          )}
        >
          <AppShell>{children}</AppShell>
        </Suspense>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
