import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { ParticleClientWrapper } from "./components/ParticleClientWrapper";
import Navbar from "./components/Navbar";

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
        <ThemeProvider>
          <ParticleClientWrapper>
            <Navbar />
            <div className="flex-1">{children}</div>
          </ParticleClientWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
