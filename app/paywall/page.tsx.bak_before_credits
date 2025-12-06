"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  Zap, 
  Star, 
  Crown,
  Loader2,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/contexts/AuthContext";
import { useRouter } from "next/navigation";

const pricingPlans = {
  weekly: [
    {
      id: 'basic-weekly',
      name: 'Basic',
      price: 6,
      period: 'week',
      jobs: 10,
      priceId: 'price_1SOBvoGfV3OgrONkrH31ZPzs',
      icon: Zap,
      popular: false,
        features: [
          '10 auto-apply uses per week',
          'AI-powered form filling',
          'Resume optimization',
          'Basic support',
          'Application tracking'
        ]
    },
    {
      id: 'student-weekly',
      name: 'Student',
      price: 10,
      period: 'week',
      jobs: 20,
      priceId: 'price_1SOBxFGfV3OgrONkjWcGYa7k',
      icon: Star,
      popular: true,
        features: [
          '20 auto-apply uses per week',
          'AI-powered form filling',
          'Resume optimization',
          'Priority support',
          'Application tracking',
          'Interview preparation tips'
        ]
    }
  ],
  monthly: [
    {
      id: 'basic-monthly',
      name: 'Basic',
      price: 20,
      period: 'month',
      jobs: 30,
      priceId: 'price_1SOBwYGfV3OgrONkSrpIhdBH',
      icon: Zap,
      popular: false,
        features: [
          '30 auto-apply uses per month',
          'AI-powered form filling',
          'Resume optimization',
          'Basic support',
          'Application tracking'
        ]
    },
    {
      id: 'student-monthly',
      name: 'Student',
      price: 35,
      period: 'month',
      jobs: 80,
      priceId: 'price_1SOBxuGfV3OgrONkamx6GPzC',
      icon: Star,
      popular: true,
        features: [
          '80 auto-apply uses per month',
          'AI-powered form filling',
          'Resume optimization',
          'Priority support',
          'Application tracking',
          'Interview preparation tips',
          'Career coaching resources'
        ]
    },
    {
      id: 'desperate-monthly',
      name: 'Desperate',
      price: 100,
      period: 'month',
      jobs: 200,
      priceId: 'price_1SOByyGfV3OgrONk3Yvj3Sdh',
      icon: Crown,
      popular: false,
        features: [
          '200 auto-apply uses per month',
          'AI-powered form filling',
          'Resume optimization',
          'Premium support',
          'Application tracking',
          'Interview preparation tips',
          'Career coaching resources',
          'Personal job search consultant',
          'Custom application strategies'
        ]
    }
  ]
};

export default function PaywallPage() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const handleSubscribe = async (priceId: string, planName: string) => {
    if (!user) {
      router.push('/auth/login?returnTo=/paywall');
      return;
    }

    setLoading(priceId);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.id,
          planName,
          successUrl: `${window.location.origin}/dashboard?subscription=success`,
          cancelUrl: `${window.location.origin}/paywall?subscription=cancelled`,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL received');
        setLoading(null);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4">
            <Crown className="mr-1 h-3 w-3" />
            Choose Your Plan
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
            Unlock Your Job Search Potential
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Let AI handle the tedious work while you focus on landing interviews. 
            Choose the plan that fits your job search intensity.
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === 'weekly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Weekly Plans
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly Plans
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto"
        >
          {pricingPlans[activeTab].map((plan, index) => {
            const Icon = plan.icon;
            const isLoading = loading === plan.priceId;
            
            return (
              <Card
                key={plan.id}
                className={`relative hover:shadow-xl transition-all duration-300 ${
                  plan.popular
                    ? 'ring-2 ring-blue-500 shadow-lg scale-105'
                    : plan.name === 'Desperate'
                    ? 'ring-2 ring-red-500 bg-red-50/30 hover:shadow-lg'
                    : 'hover:shadow-lg'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                {/* Trial badge for Student/Basic monthly */}
                {activeTab === 'monthly' && (plan.id === 'basic-monthly' || plan.id === 'student-monthly') && (
                  <div className="absolute -top-3 right-3">
                    <Badge className="bg-green-600 text-white px-3 py-1">
                      3-day free trial
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className={`p-3 rounded-full ${
                      plan.popular 
                        ? 'bg-blue-100 text-blue-600' 
                        : plan.name === 'Desperate'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                  
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {plan.name}
                  </CardTitle>
                  
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">
                      ${plan.price}
                    </span>
                    <span className="text-gray-600">/{plan.period}</span>
                  </div>
                  {activeTab === 'monthly' && (plan.id === 'basic-monthly' || plan.id === 'student-monthly') && (
                    <p className="text-xs text-green-700 mt-1">Try it free for 3 days, then ${plan.price}/{plan.period}</p>
                  )}
                  
                  <p className="text-sm text-gray-600 mt-2">
                    {plan.jobs} auto-apply uses per {plan.period}
                  </p>
                </CardHeader>

                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSubscribe(plan.priceId, plan.name)}
                    disabled={isLoading}
                    className={`w-full ${
                      plan.popular
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : plan.name === 'Desperate'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gray-900 hover:bg-gray-800'
                    }`}
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Get Started
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Transform Your Job Search?
            </h3>
            <p className="text-gray-600 mb-6">
              Join thousands of job seekers who have automated their applications 
              and landed their dream jobs faster than ever before.
            </p>
            <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>No setup fees</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>Instant access</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
