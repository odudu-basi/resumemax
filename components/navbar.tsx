"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText, Zap, DollarSign, Info, User, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import { useEffect } from "react";
import MixpanelService from "@/src/lib/mixpanel";

const navigation = [
  { name: "Features", href: "/#features", icon: Zap },
  { name: "Pricing", href: "/pricing", icon: DollarSign },
  { name: "About", href: "/about", icon: Info },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, signOut, loading } = useAuth();
  const isOnboardingPage = pathname === '/onboarding';

  // Track navbar style change
  useEffect(() => {
    if (isOnboardingPage) {
      MixpanelService.track('navbar_glassmorphic_displayed', {
        user_id: user?.id,
        page: 'onboarding',
      });
    }
  }, [isOnboardingPage, user?.id]);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`sticky top-0 z-50 ${
        isOnboardingPage 
          ? 'border-none bg-transparent' 
          : 'border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'
      }`}
    >
      <div className={`${
        isOnboardingPage 
          ? 'flex justify-center px-4 py-4' 
          : 'container mx-auto px-4 sm:px-6 lg:px-8'
      }`}>
        {isOnboardingPage ? (
          // Glassmorphic centered navbar for onboarding
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex items-center justify-center gap-8 px-8 py-4 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 rounded-full shadow-lg"
          >
            <Link href="/" className="flex items-center space-x-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-2"
              >
                <FileText className="h-6 w-6 text-blue-100" />
                <span className="text-lg font-bold text-blue-100">ResumeMax</span>
              </motion.div>
            </Link>
            
            <div className="flex items-center gap-6">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.name} href={item.href}>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        variant="ghost"
                        className="flex items-center space-x-2 text-blue-200 hover:text-blue-100 hover:bg-blue-400/20"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{item.name}</span>
                      </Button>
                    </motion.div>
                  </Link>
                );
              })}
            </div>

            {/* Auth Section for Glassmorphic Navbar */}
            <div className="flex items-center gap-3">
              {!loading && (
                <>
                  {user ? (
                    <div className="flex items-center gap-2">
                      <Link href="/dashboard">
                        <Button variant="ghost" className="flex items-center gap-2 text-blue-200 hover:text-blue-100 hover:bg-blue-400/20">
                          <User className="h-4 w-4" />
                          <span className="hidden sm:inline">Dashboard</span>
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        onClick={() => signOut()}
                        className="flex items-center gap-2 text-blue-200 hover:text-blue-100 hover:bg-blue-400/20"
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="hidden sm:inline">Sign Out</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link href="/auth/login">
                        <Button variant="ghost" className="text-blue-200 hover:text-blue-100 hover:bg-blue-400/20">
                          Sign In
                        </Button>
                      </Link>
                      <Link href="/auth/signup">
                        <Button className="bg-blue-600/80 hover:bg-blue-600 text-white border-blue-500/50">
                          Sign Up
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        ) : (
          // Regular navbar for other pages
          <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-2"
              >
                <FileText className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">ResumeMax</span>
              </motion.div>
            </Link>
          </div>

            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.name} href={item.href}>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          className="flex items-center space-x-2"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </Button>
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Auth Section */}
            <div className="flex items-center gap-4">
              {!loading && (
                <>
                  {user ? (
                    <div className="flex items-center gap-2">
                      <Link href="/dashboard">
                        <Button variant="ghost" className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="hidden sm:inline">Dashboard</span>
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        onClick={() => signOut()}
                        className="flex items-center gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="hidden sm:inline">Sign Out</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link href="/auth/login">
                        <Button variant="ghost">Sign In</Button>
                      </Link>
                      <Link href="/auth/signup">
                        <Button>Sign Up</Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.nav>
  );
}
