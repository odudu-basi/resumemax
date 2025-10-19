"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Zap, Crown, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import MixpanelService from "@/src/lib/mixpanel";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started with resume analysis",
    features: [
      "1 resume analysis per month",
      "Basic scoring and feedback",
      "ATS compatibility check",
      "Email support"
    ],
    limitations: [
      "Limited detailed recommendations",
      "No keyword optimization",
      "Basic formatting suggestions"
    ],
    icon: Users,
    popular: false,
    cta: "Get Started Free"
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "Ideal for active job seekers and professionals",
    features: [
      "Unlimited resume analyses",
      "Detailed AI-powered feedback",
      "Advanced keyword optimization",
      "Industry-specific recommendations",
      "ATS optimization score",
      "Cover letter analysis",
      "Priority email support",
      "Resume templates access"
    ],
    limitations: [],
    icon: Zap,
    popular: true,
    cta: "Start Pro Trial"
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "per month",
    description: "For teams, recruiters, and career services",
    features: [
      "Everything in Pro",
      "Team management dashboard",
      "Bulk resume processing",
      "Custom branding",
      "API access",
      "Advanced analytics",
      "Dedicated account manager",
      "Custom integrations",
      "White-label solution"
    ],
    limitations: [],
    icon: Crown,
    popular: false,
    cta: "Contact Sales"
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
  const { user } = useAuth();

  // Track pricing page view
  useEffect(() => {
    MixpanelService.trackPricingPageViewed({
      user_id: user?.id,
      referrer_page: document.referrer || 'direct',
    });
  }, [user?.id]);
  return (
    <div className="py-16">
      {/* Header */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
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
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Choose Your Plan
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
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
                    <Badge className="bg-gradient-to-r from-blue-600 to-purple-600">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <Card className={`h-full ${plan.popular ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Icon className="h-4 w-4 text-blue-600" />
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
                      className={`w-full ${plan.popular ? 'bg-gradient-to-r from-blue-600 to-purple-600' : ''}`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
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
          <Card>
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
                      <th className="text-center py-3 px-4">Pro</th>
                      <th className="text-center py-3 px-4">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="border-b">
                      <td className="py-3 px-4">Resume analyses per month</td>
                      <td className="text-center py-3 px-4">1</td>
                      <td className="text-center py-3 px-4">Unlimited</td>
                      <td className="text-center py-3 px-4">Unlimited</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">AI-powered feedback</td>
                      <td className="text-center py-3 px-4">Basic</td>
                      <td className="text-center py-3 px-4">Advanced</td>
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
                      <td className="text-center py-3 px-4"><Check className="h-4 w-4 text-green-600 mx-auto" /></td>
                      <td className="text-center py-3 px-4"><Check className="h-4 w-4 text-green-600 mx-auto" /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Team management</td>
                      <td className="text-center py-3 px-4">-</td>
                      <td className="text-center py-3 px-4">-</td>
                      <td className="text-center py-3 px-4"><Check className="h-4 w-4 text-green-600 mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">API access</td>
                      <td className="text-center py-3 px-4">-</td>
                      <td className="text-center py-3 px-4">-</td>
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
            <h2 className="text-3xl font-bold text-gray-900">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-lg text-gray-600">
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
                <Card>
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
