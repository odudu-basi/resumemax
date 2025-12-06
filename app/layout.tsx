import type { Metadata } from "next";
import { Geist, Geist_Mono, Pacifico } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { OnboardingProvider } from "@/src/contexts/OnboardingContext";
import { Analytics } from '@vercel/analytics/react';
import dynamic from "next/dynamic";
import { Toaster } from 'sonner';
import { PostHogProvider } from '@/src/providers/PostHogProvider';
const AuthExchange = dynamic(() => import("@/src/components/AuthExchange"));

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pacifico = Pacifico({
  weight: "400",
  variable: "--font-pacifico",
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
        className={`${geistSans.variable} ${geistMono.variable} ${pacifico.variable} antialiased`}
      >
        <PostHogProvider>
          <AuthProvider>
            <OnboardingProvider>
              {children}
            </OnboardingProvider>
          </AuthProvider>
          <Toaster position="top-right" richColors />
          <AuthExchange />
          <Analytics />
        </PostHogProvider>
      </body>
    </html>
  );
}
