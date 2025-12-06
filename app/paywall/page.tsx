"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Zap,
  Star,
  Crown,
  Loader2,
  ArrowRight,
  Rocket,
  TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

const pricingPlans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 10,
    period: 'week',
    applications: 20,
    priceId: 'price_1SOBxFGfV3OgrONkjWcGYa7k',
    icon: TrendingUp,
    popular: false,
    features: [
      '20 job applications per week',
      'AI-powered application filling',
      'Advanced resume parsing',
      'Application tracking dashboard',
      'Cover letter generation',
      'Email notifications',
      'Priority support'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 20,
    period: 'month',
    applications: 30,
    priceId: 'price_1SOBwYGfV3OgrONkSrpIhdBH',
    icon: Rocket,
    popular: true,
    features: [
      '30 job applications per month',
      'AI-powered application filling',
      'Advanced resume parsing',
      'Application tracking dashboard',
      'Cover letter generation',
      'Email notifications',
      'Priority support',
      'Resume optimization tips',
      'Interview preparation guides'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 35,
    period: 'month',
    applications: 80,
    priceId: 'price_1SOBxuGfV3OgrONkamx6GPzC',
    icon: Crown,
    popular: false,
    features: [
      '80 job applications per month',
      'AI-powered application filling',
      'Advanced resume parsing',
      'Application tracking dashboard',
      'Cover letter generation',
      'Email notifications',
      'Priority support',
      'Resume optimization tips',
      'Interview preparation guides',
      'LinkedIn profile optimization',
      'Dedicated account manager'
    ]
  }
];

export default function PaywallPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleUpgrade = async (plan: typeof pricingPlans[0]) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    setLoadingPlan(plan.id);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          userId: user.id,
          planName: plan.name,
          autoApplyLimit: plan.applications
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge className="mb-4 bg-gradient-to-r from-gray-800 to-black text-white px-4 py-1">
            Unlock Full Access
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">
            Stop Wasting Hours on Repetitive Applications
          </h1>
          <p className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto">
            Your time is valuable. Let AI handle the tedious form-filling while you focus on landing interviews.
          </p>
        </motion.div>

        {/* Free Trial CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mb-12"
        >
          <p className="text-xl font-semibold text-gray-800 mb-4">
            You get 5 free applications on us!
          </p>
          <Link href="/dashboard">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Try for Free
            </Button>
          </Link>
        </motion.div>

        {/* Divider */}
        <div className="relative mb-12">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">
              Or choose a plan for more applications
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {pricingPlans.map((plan, index) => {
            const Icon = plan.icon;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-gray-800 to-black text-white px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <Card className={`h-full transition-all hover:shadow-xl ${
                  plan.popular
                    ? 'ring-2 ring-gray-800 shadow-lg'
                    : 'border-gray-200'
                }`}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        plan.popular ? 'bg-gray-100' : 'bg-gray-50'
                      }`}>
                        <Icon className="h-5 w-5 text-gray-800" />
                      </div>
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    </div>

                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-gray-600">/{plan.period}</span>
                    </div>

                    <Badge variant="outline" className="text-base font-semibold w-fit">
                      {plan.applications} applications/{plan.period}
                    </Badge>

                    <CardDescription className="text-base mt-3">
                      Perfect for {plan.applications < 30 ? 'focused' : plan.applications < 100 ? 'active' : 'power'} job searching
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <Button
                      onClick={() => handleUpgrade(plan)}
                      disabled={loadingPlan === plan.id}
                      className={`w-full mb-6 ${
                        plan.popular
                          ? 'bg-gradient-to-r from-gray-800 to-black hover:from-gray-900 hover:to-black'
                          : 'bg-gray-800 hover:bg-gray-900'
                      }`}
                      size="lg"
                    >
                      {loadingPlan === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Upgrade Now
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <div className="space-y-3">
                      <p className="font-semibold text-sm text-gray-900">Includes:</p>
                      <ul className="space-y-2.5">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-700">{feature}</span>
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

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center"
        >
          <p className="text-gray-600 mb-2">
            All plans include a 7-day money-back guarantee
          </p>
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="text-gray-700 hover:text-gray-900"
          >
            Return to Dashboard
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
