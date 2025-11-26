"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ElevenLabsAgent from "@/src/components/ElevenLabsAgent";

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
    // You can add logic here to store the selection and proceed to next step
    // For now, we'll just proceed to the next onboarding step
    setTimeout(() => {
      router.push('/onboarding/step-2');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 via-30% via-gray-200 via-60% to-black relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-radial from-gray-300/30 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-gray-800/20 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-gray-400/10 to-transparent rounded-full blur-3xl"></div>

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* Simple Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-4 z-50 flex justify-center px-4 py-4"
      >
        <div className="flex items-center justify-between w-full max-w-6xl px-8 py-4 bg-black/60 backdrop-blur-xl border border-white/30 rounded-full shadow-2xl">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="ResumeMax Logo" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-bold text-white">ResumeMax</span>
          </Link>

          {/* Skip Button */}
          <Link href="/auth/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
            >
              Skip Onboarding
            </Button>
          </Link>
        </div>
      </motion.nav>

      {/* Main Content */}
      <section className="relative z-10 py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* JJ Introduction */}
              <div className="mb-12">
                <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <span className="text-2xl font-bold text-white">Valentino</span>
                </div>
                <p className="text-lg text-gray-600 mb-2">
                  Hi, my name is <span className="font-semibold text-blue-600">Valentino</span>
                </p>
                <p className="text-lg text-gray-600">
                  I am your personal career assistant and onboarding guide
                </p>
              </div>

              {/* Main Question */}
              <h1 className="text-4xl font-bold tracking-tight text-black sm:text-6xl mb-16">
                Welcome, let's{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  get started
                </span>
              </h1>

              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-8"
              >
                <Button
                  size="lg"
                  className="text-lg px-12 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                  onClick={() => router.push('/onboarding/step-2')}
                >
                  Continue
                </Button>
              </motion.div>

              {/* Progress Indicator */}
              <div className="mt-16 flex justify-center">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ElevenLabs AI Agent */}
      <ElevenLabsAgent />
    </div>
  );
}
