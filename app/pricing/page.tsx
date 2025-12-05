"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Zap, Crown, Users, Loader2, Home as HomeIcon, LogOut, Rocket, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import MixpanelService from "@/src/lib/mixpanel";
import Link from "next/link";
import Image from "next/image";

const plans = [
  {
    id: "basic",
    name: "Basic",
    price: "$10",
    period: "per week",
    description: "Perfect for getting started",
    applications: 20,
    features: [
      "20 job applications per week",
      "AI-powered application filling",
      "Advanced resume parsing",
      "Application tracking dashboard",
      "Cover letter generation",
      "Email notifications",
      "Priority support"
    ],
    limitations: [],
    icon: TrendingUp,
    popular: false,
    cta: "Get Started",
    priceId: "price_1SOBxFGfV3OgrONkjWcGYa7k"
  },
  {
    id: "pro",
    name: "Pro",
    price: "$20",
    period: "per month",
    description: "Best for active job seekers",
    applications: 30,
    features: [
      "30 job applications per month",
      "AI-powered application filling",
      "Advanced resume parsing",
      "Application tracking dashboard",
      "Cover letter generation",
      "Email notifications",
      "Priority support",
      "Resume optimization tips",
      "Interview preparation guides"
    ],
    limitations: [],
    icon: Rocket,
    popular: true,
    cta: "Go Pro",
    priceId: "price_1SOBwYGfV3OgrONkSrpIhdBH"
  },
  {
    id: "premium",
    name: "Premium",
    price: "$35",
    period: "per month",
    description: "Maximum application power",
    applications: 80,
    features: [
      "80 job applications per month",
      "AI-powered application filling",
      "Advanced resume parsing",
      "Application tracking dashboard",
      "Cover letter generation",
      "Email notifications",
      "Priority support",
      "Resume optimization tips",
      "Interview preparation guides",
      "LinkedIn profile optimization",
      "Dedicated account manager"
    ],
    limitations: [],
    icon: Crown,
    popular: false,
    cta: "Go Premium",
    priceId: "price_1SOBxuGfV3OgrONkamx6GPzC"
  }
];

const faqs = [
  {
    question: "How do application credits work?",
    answer: "Each plan comes with a monthly allowance of job applications. Credits are used when you successfully submit an application through our AI-powered system. Credits reset at the beginning of each billing cycle."
  },
  {
    question: "What happens when I run out of credits?",
    answer: "When you run out of application credits, you'll be prompted to upgrade to a higher tier. You can upgrade at any time, and unused credits from your previous plan will be added to your new plan's allowance."
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel your subscription at any time. There are no long-term commitments, and you'll continue to have access to your plan features until the end of your billing period."
  },
  {
    question: "Do my credits roll over to the next month?",
    answer: "No, credits reset monthly on your billing cycle. This ensures you always have a fresh allocation of applications each month. We recommend using your credits strategically throughout the month."
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use enterprise-grade encryption and never share your personal information. Your resume data is processed securely and can be deleted from our servers at any time upon request."
  }
];

export default function PricingPage() {
  const { user, signOut } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  // Fetch user's current subscription
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user?.id) {
        setLoadingSubscription(false);
        return;
      }

      try {
        const response = await fetch(`/api/subscription/status?userId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentPlan(data.subscription.planName);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoadingSubscription(false);
      }
    };

    fetchSubscription();
  }, [user?.id]);

  const handlePlanSelect = async (plan: typeof plans[0]) => {
    if (!user) {
      window.location.href = '/auth/login';
      return;
    }

    // Free plan - just redirect to dashboard
    if (plan.id === 'free' || !plan.priceId) {
      window.location.href = '/dashboard';
      return;
    }

    setLoadingPlan(plan.id);
    MixpanelService.track('Pricing Plan Selected', {
      plan_name: plan.name,
      plan_price: plan.price,
      user_id: user.id
    });

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          userId: user.id,
          planName: plan.name
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-gray-800 to-black rounded-lg flex items-center justify-center">
                <Image
                  src="/icon.png"
                  alt="ResumeMax"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
              </div>
              <span className="text-xl font-bold text-gray-900">ResumeMax</span>
            </Link>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Link href="/dashboard">
                    <Button variant="ghost" size="sm">
                      <HomeIcon className="h-4 w-4 mr-2" />
                      Dashboard
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/auth/login">
                    <Button variant="ghost" size="sm">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button size="sm" className="bg-gradient-to-r from-gray-800 to-black">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold text-black mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-700 max-w-2xl mx-auto">
            Choose the plan that fits your job search needs. All plans include AI-powered applications.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const isCurrentPlan = currentPlan?.toLowerCase() === plan.name.toLowerCase();
            const isFree = plan.id === 'free';

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative"
              >
                {isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                      Current Plan
                    </Badge>
                  </div>
                )}
                {!isCurrentPlan && plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-gray-800 to-black text-white">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <Card className={`h-full bg-white/80 backdrop-blur-sm ${
                  isCurrentPlan
                    ? 'ring-2 ring-green-600 shadow-lg border-green-500'
                    : plan.popular
                    ? 'ring-2 ring-gray-800 shadow-lg border-gray-200'
                    : 'border-gray-200'
                }`}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isCurrentPlan ? 'bg-green-100' : isFree ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          isCurrentPlan ? 'text-green-700' : isFree ? 'text-blue-600' : 'text-gray-800'
                        }`} />
                      </div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-gray-600">/{plan.period}</span>
                    </div>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-base font-semibold">
                        {plan.applications} applications/month
                      </Badge>
                    </div>
                    <CardDescription className="text-base mt-2">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={() => handlePlanSelect(plan)}
                      disabled={loadingPlan === plan.id || isCurrentPlan}
                      className={`w-full ${
                        isCurrentPlan
                          ? 'bg-green-600/50 border-green-600 cursor-default'
                          : isFree
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : plan.popular
                          ? 'bg-gradient-to-r from-gray-800 to-black'
                          : 'border-gray-800 text-gray-800 hover:bg-gray-50'
                      }`}
                      variant={isCurrentPlan || plan.popular || isFree ? "default" : "outline"}
                    >
                      {loadingPlan === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : isCurrentPlan ? (
                        'Current Plan'
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

          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
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
