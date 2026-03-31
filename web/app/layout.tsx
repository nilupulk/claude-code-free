import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { ToastProvider } from "@/components/notifications/ToastProvider";
import { PerformanceObserverBootstrap } from "@/components/layout/PerformanceObserver";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { BackendProvider, ConnectionStatusBanner } from "@/lib/BackendContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090f" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export const metadata: Metadata = {
  title: "Claude Code",
  description: "Claude Code — AI-powered development assistant",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Claude Code",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: "/favicon.ico",
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <PerformanceObserverBootstrap />
        <AnalyticsProvider>
          <ThemeProvider>
            <BackendProvider url={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}>
              <ConnectionStatusBanner />
              <ToastProvider>
                {children}
                <ConsentBanner />
              </ToastProvider>
            </BackendProvider>
          </ThemeProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
