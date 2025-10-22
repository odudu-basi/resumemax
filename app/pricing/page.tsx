"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Zap, Crown, Users, Loader2, Home as HomeIcon, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import MixpanelService from "@/src/lib/mixpanel";
import Link from "next/link";
import Image from "next/image";

const plans = [
  {
    id: "unlimited",
    name: "Unlimited",
    price: "$9.99",
    period: "per month",
    description: "For power users and professionals",
    features: [
      "Unlimited resume analyses",
      "Unlimited PDF downloads",
      "Advanced AI-powered feedback",
      "Industry-specific recommendations",
      "Cover letter analysis",
      "Resume templates access",
      "Priority support",
      "Advanced keyword optimization",
      "Export to multiple formats"
    ],
    limitations: [],
    icon: Crown,
    popular: true,
    cta: "Go Unlimited",
    priceId: "price_1SFol1GfV3OgrONkCw68vdG1"
  },
  {
    id: "basic",
    name: "Basic",
    price: "$4",
    period: "per month",
    description: "Great for job seekers who need more analyses",
    features: [
      "25 resume analyses per month",
      "10 PDF downloads per month",
      "Detailed AI-powered feedback",
      "Keyword optimization suggestions",
      "ATS optimization score",
      "Resume format recommendations",
      "Priority email support"
    ],
    limitations: [],
    icon: Zap,
    popular: false,
    cta: "Start Basic Plan",
    priceId: "price_1SJGF6GfV3OgrONkHsG1SRpl"
  },
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started with resume analysis",
    features: [
      "3 resume analyses per month",
      "Basic scoring and feedback",
      "ATS compatibility check",
      "No PDF downloads",
      "Email support"
    ],
    limitations: [
      "Limited detailed recommendations",
      "No keyword optimization",
      "Basic formatting suggestions"
    ],
    icon: Users,
    popular: false,
    cta: "Get Started Free",
    priceId: null
  }
];

const faqs = [
  {
    question: "How accurate is the AI analysis?",
    answer: "Our AI has been trained on thousands of successful resumes and recruiter feedback. It provides 94% accuracy in identifying areas for improvement and has helped users increase their interview rates by an average of 32%."
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel your subscription at any time. There are no long-term commitments, and you'll continue to have access to your plan features until the end of your billing period."
  },
  {
    question: "What file formats do you support?",
    answer: "We support PDF, DOC, and DOCX formats. For best results, we recommend uploading your resume as a PDF to preserve formatting."
  },
  {
    question: "Is my resume data secure?",
    answer: "Absolutely. We use enterprise-grade encryption and never share your personal information. Your resume data is processed securely and can be deleted from our servers at any time upon request."
  }
];

export default function PricingPage() {
  const { user, signOut } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Track pricing page view
  useEffect(() => {
    MixpanelService.trackPricingPageViewed({
      user_id: user?.id,
      referrer_page: document.referrer || 'direct',
    });
  }, [user?.id]);

  const handlePlanSelect = async (plan: typeof plans[0]) => {
    if (!user) {
      // Redirect to signup if not authenticated
      window.location.href = `/auth/signup?returnTo=${encodeURIComponent('/pricing')}`;
      return;
    }

    if (plan.id === 'free') {
      // Free plan - redirect to dashboard
      window.location.href = '/dashboard';
      return;
    }

    if (!plan.priceId) {
      console.error('No price ID for plan:', plan.name);
      return;
    }

    setLoadingPlan(plan.id);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: plan.id,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };
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

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/#features">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                Features
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                Pricing
              </Button>
            </Link>
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/dashboard">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 flex items-center gap-2"
                  >
                    <HomeIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="text-white hover:bg-white/20 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button
                    size="sm"
                    className="bg-white text-black hover:bg-gray-100"
                  >
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Header */}
      <section className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">
            <Star className="mr-1 h-3 w-3" />
            Pricing Plans
          </Badge>
          <h1 className="text-4xl font-bold text-black sm:text-5xl">
            Choose Your Plan
          </h1>
          <p className="mt-4 text-lg text-gray-700 max-w-2xl mx-auto">
            Start free and upgrade as you grow. All plans include our core AI analysis features.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid gap-8 lg:grid-cols-3 mb-16">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative"
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-gray-800 to-black text-white">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <Card className={`h-full bg-white/80 backdrop-blur-sm border-gray-200 ${plan.popular ? 'ring-2 ring-gray-800 shadow-lg' : ''}`}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Icon className="h-4 w-4 text-gray-800" />
                      </div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-gray-600">/{plan.period}</span>
                    </div>
                    <CardDescription className="text-base">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={() => handlePlanSelect(plan)}
                      disabled={loadingPlan === plan.id}
                      className={`w-full ${plan.popular ? 'bg-gradient-to-r from-gray-800 to-black' : 'border-gray-800 text-gray-800 hover:bg-gray-50'}`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {loadingPlan === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        plan.cta
                      )}
                    </Button>
                    
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-900">What's included:</h4>
                      <ul className="space-y-2">
                        {plan.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-600">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Features Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mb-16"
        >
          <Card className="bg-white/80 backdrop-blur-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-center">Feature Comparison</CardTitle>
              <CardDescription className="text-center">
                Compare all features across our plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Feature</th>
                      <th className="text-center py-3 px-4">Free</th>
                      <th className="text-center py-3 px-4">Basic</th>
                      <th className="text-center py-3 px-4">Unlimited</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="border-b">
                      <td className="py-3 px-4">Resume analyses per month</td>
                      <td className="text-center py-3 px-4">3</td>
                      <td className="text-center py-3 px-4">25</td>
                      <td className="text-center py-3 px-4">Unlimited</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">PDF downloads per month</td>
                      <td className="text-center py-3 px-4">0</td>
                      <td className="text-center py-3 px-4">10</td>
                      <td className="text-center py-3 px-4">Unlimited</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">AI-powered feedback</td>
                      <td className="text-center py-3 px-4">Basic</td>
                      <td className="text-center py-3 px-4">Detailed</td>
                      <td className="text-center py-3 px-4">Advanced</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Keyword optimization</td>
                      <td className="text-center py-3 px-4">-</td>
                      <td className="text-center py-3 px-4"><Check className="h-4 w-4 text-green-600 mx-auto" /></td>
                      <td className="text-center py-3 px-4"><Check className="h-4 w-4 text-green-600 mx-auto" /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Cover letter analysis</td>
                      <td className="text-center py-3 px-4">-</td>
                      <td className="text-center py-3 px-4">-</td>
                      <td className="text-center py-3 px-4"><Check className="h-4 w-4 text-green-600 mx-auto" /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Resume templates</td>
                      <td className="text-center py-3 px-4">-</td>
                      <td className="text-center py-3 px-4">-</td>
                      <td className="text-center py-3 px-4"><Check className="h-4 w-4 text-green-600 mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Priority support</td>
                      <td className="text-center py-3 px-4">-</td>
                      <td className="text-center py-3 px-4"><Check className="h-4 w-4 text-green-600 mx-auto" /></td>
                      <td className="text-center py-3 px-4"><Check className="h-4 w-4 text-green-600 mx-auto" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-black">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-lg text-gray-700">
              Got questions? We've got answers.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-gray-200">
                  <CardHeader>
                    <CardTitle className="text-lg">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {faq.answer}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
