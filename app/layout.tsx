import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { OnboardingProvider } from "@/src/contexts/OnboardingContext";
import { Analytics } from '@vercel/analytics/react';
import dynamic from "next/dynamic";
import { Toaster } from 'sonner';
const AuthExchange = dynamic(() => import("@/src/components/AuthExchange"));

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ResumeMax - AI-Powered Resume Analysis",
  description: "Get instant feedback on your resume with AI-powered analysis and scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <OnboardingProvider>
            {children}
          </OnboardingProvider>
        </AuthProvider>
        <Toaster position="top-right" richColors />
        <AuthExchange />
        <Analytics />
      </body>
    </html>
  );
}
