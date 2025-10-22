"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText, Zap, DollarSign, Info, User, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";

const navigation = [
  { name: "Features", href: "/#features", icon: Zap },
  { name: "Pricing", href: "/pricing", icon: DollarSign },
  { name: "About", href: "/about", icon: Info },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, signOut, loading } = useAuth();

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center space-x-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-2"
              >
                <Image src="/logo.png" alt="ResumeMax Logo" width={32} height={32} className="h-8 w-8" />
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
      </div>
    </motion.nav>
  );
}
