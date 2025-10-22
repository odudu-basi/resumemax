'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { FileText, BarChart3, Zap, User, LogOut, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/src/contexts/AuthContext';
import MixpanelService from '@/src/lib/mixpanel';

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  // Track dashboard visit
  useEffect(() => {
    if (user) {
      MixpanelService.trackDashboardVisited({
        user_id: user.id,
      });
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
      return;
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-100 to-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 via-30% via-gray-200 via-60% to-black relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-radial from-gray-300/30 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-gray-800/20 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-gray-400/10 to-transparent rounded-full blur-3xl"></div>

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* Glassmorphic Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="sticky top-4 z-50 flex justify-center px-4 py-4"
      >
        <div className="flex items-center justify-center gap-8 px-8 py-4 bg-black/60 backdrop-blur-xl border border-white/30 rounded-full shadow-2xl">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2"
            >
              <Image src="/logo.png" alt="ResumeMax Logo" width={32} height={32} className="h-8 w-8" />
              <span className="text-lg font-bold text-white">ResumeMax</span>
            </motion.div>
          </Link>

          {/* Navigation Items */}
          <div className="flex items-center gap-4">
            <Link href="/">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 text-white/90 hover:text-white hover:bg-white/20"
                >
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </motion.div>
            </Link>

            <Link href="/pricing">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 text-white/90 hover:text-white hover:bg-white/20"
                >
                  <span>Pricing</span>
                </Button>
              </motion.div>
            </Link>
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3 border-l border-white/30 pl-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-white/90 text-sm">
                <User className="h-4 w-4" />
                <span className="hidden md:inline">{user?.user_metadata?.full_name || 'User'}</span>
              </div>
              <Button
                variant="ghost"
                onClick={() => signOut()}
                className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/20"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center px-4 pb-20 pt-12">
        <div className="w-full max-w-2xl">
          {/* Welcome Message */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl font-bold bg-gradient-to-br from-gray-900 via-gray-700 to-black bg-clip-text text-transparent mb-3">
              Welcome back, {user?.user_metadata?.full_name || 'User'}
            </h1>
            <p className="text-xl text-gray-700">
              What would you like to do today?
            </p>
          </motion.div>

          {/* Three Action Buttons */}
          <div className="space-y-4">
            {/* Create Resume Button */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => router.push('/create-resume')}
                  className="w-full h-24 text-2xl font-semibold bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-900 hover:to-black text-white shadow-2xl border border-gray-700 transition-all duration-300 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <FileText className="h-7 w-7 mr-3 relative z-10" />
                  <span className="relative z-10">Create Resume</span>
                </Button>
              </motion.div>
            </motion.div>

            {/* Rate Resume Button */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => router.push('/rate-resume')}
                  className="w-full h-24 text-2xl font-semibold bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 hover:from-gray-800 hover:to-black text-white shadow-2xl border border-gray-600 transition-all duration-300 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <BarChart3 className="h-7 w-7 mr-3 relative z-10" />
                  <span className="relative z-10">Rate Resume</span>
                </Button>
              </motion.div>
            </motion.div>

            {/* Tailor Resume Button */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => router.push('/tailor-resume')}
                  className="w-full h-24 text-2xl font-semibold bg-gradient-to-r from-gray-600 via-gray-700 to-gray-800 hover:from-gray-700 hover:to-gray-900 text-white shadow-2xl border border-gray-500 transition-all duration-300 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <Zap className="h-7 w-7 mr-3 relative z-10" />
                  <span className="relative z-10">Tailor Resume</span>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
