'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Zap, TrendingUp, Rocket, X } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: string;
  creditsRemaining?: number;
}

const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: '$10',
    period: 'week',
    applications: 20,
    priceId: 'price_1SOBxFGfV3OgrONkjWcGYa7k',
    icon: TrendingUp,
    color: 'from-gray-600 to-gray-800',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    period: 'month',
    applications: 30,
    priceId: 'price_1SOBwYGfV3OgrONkSrpIhdBH',
    icon: Rocket,
    color: 'from-gray-700 to-gray-900',
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$35',
    period: 'month',
    applications: 80,
    priceId: 'price_1SOBxuGfV3OgrONkamx6GPzC',
    icon: Crown,
    color: 'from-gray-800 to-black',
    popular: false,
  },
];

export default function UpgradeModal({
  isOpen,
  onClose,
  currentPlan = 'Free',
  creditsRemaining = 0,
}: UpgradeModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async (priceId: string) => {
    setIsLoading(true);
    try {
      // Redirect to pricing page where they can select and checkout
      router.push('/pricing');
    } catch (error) {
      console.error('Error upgrading:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Upgrade Your Plan
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="text-base">
            {creditsRemaining === 0 ? (
              <span className="text-red-600 font-semibold">
                You've run out of application credits!
              </span>
            ) : (
              <span>
                You have {creditsRemaining} credit{creditsRemaining !== 1 ? 's' : ''} remaining.
              </span>
            )}{' '}
            Upgrade to continue applying to jobs and accelerate your job search.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className={`relative border rounded-lg p-6 hover:shadow-lg transition-all ${
                    plan.popular ? 'border-purple-500 border-2' : 'border-gray-200'
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600">
                      Most Popular
                    </Badge>
                  )}

                  <div className="text-center mb-4">
                    <div
                      className={`inline-flex p-3 rounded-full bg-gradient-to-br ${plan.color} mb-3`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-500 text-sm">/{plan.period}</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-center gap-2 text-gray-700">
                      <span className="text-2xl font-bold text-purple-600">
                        {plan.applications}
                      </span>
                      <span className="text-sm">applications/month</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleUpgrade(plan.priceId)}
                    disabled={isLoading}
                    className={`w-full bg-gradient-to-r ${plan.color} hover:opacity-90 text-white`}
                  >
                    {isLoading ? 'Processing...' : 'Upgrade Now'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Why Upgrade?
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Apply to more jobs automatically</li>
            <li>✓ Save hours of manual application work</li>
            <li>✓ Increase your chances of landing interviews</li>
            <li>✓ Credits reset monthly on your billing cycle</li>
          </ul>
        </div>

        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
