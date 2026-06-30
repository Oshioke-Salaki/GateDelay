import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { ParticleClientWrapper } from "./components/ParticleClientWrapper";
import Navbar from "./components/Navbar";
import { ToastProvider } from "./components/ToastProvider";
import { WebSocketProvider } from "./components/WebSocketProvider";
import { PageErrorBoundary } from "./components/ui/PageErrorBoundary";
import { GlobalErrorHandler } from "./components/GlobalErrorHandler";
import PendingTransactions from "../components/transactions/PendingTransactions";
import BackupReminder from "../components/wallet/BackupReminder";
import { ConnectivityProvider } from "./components/ConnectivityProvider";
import OfflineDetection from "../components/network/OfflineDetection";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GateDelay",
  description: "Flight prediction markets on Mantle",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <PageErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              <GlobalErrorHandler />
              <ParticleClientWrapper>
                <WebSocketProvider>
                  <ConnectivityProvider>
                    <OfflineDetection />
                    <Navbar />
                    <BackupReminder />
                    <div className="flex-1">{children}</div>
                    <PendingTransactions />
                  </ConnectivityProvider>
                </WebSocketProvider>
              </ParticleClientWrapper>
            </ToastProvider>
          </ThemeProvider>
        </PageErrorBoundary>
      </body>
    </html>
  );
}
