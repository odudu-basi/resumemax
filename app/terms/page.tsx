"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <div className="space-y-8 text-gray-700">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p>
                Welcome to ResumeMax.ai, operated by Odanta LLC ("Company," "we," "our," or "us"). By accessing or using our website at resumemax.ai and related services (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
              <p className="mb-3">
                ResumeMax.ai is an AI-powered job application automation platform that provides the following services:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Resume creation, optimization, and tailoring for specific job opportunities</li>
                <li>Automated job searching across multiple platforms and companies</li>
                <li>Intelligent job matching based on your profile and preferences</li>
                <li>Automated form filling and job application submission</li>
                <li>Application tracking and management</li>
                <li>AI-powered cover letter generation and customization</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts and Registration</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">3.1 Account Creation</h3>
              <p>
                To use our Service, you must create an account by providing accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">3.2 Eligibility</h3>
              <p>
                You must be at least 18 years old and legally capable of entering into binding contracts to use our Service. By using the Service, you represent and warrant that you meet these requirements.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">3.3 Account Security</h3>
              <p>
                You agree to immediately notify us of any unauthorized use of your account or any other breach of security. We will not be liable for any loss or damage arising from your failure to protect your account credentials.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Subscription and Payment</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">4.1 Subscription Plans</h3>
              <p className="mb-3">
                We offer various subscription plans with different features and pricing. By subscribing to a paid plan, you agree to pay all applicable fees as described on our pricing page.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">4.2 Payment Processing</h3>
              <p>
                All payments are processed through third-party payment processors (Stripe). You agree to provide accurate payment information and authorize us to charge your selected payment method.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">4.3 Automatic Renewal</h3>
              <p>
                Subscriptions automatically renew at the end of each billing period unless you cancel before the renewal date. You can cancel your subscription at any time through your account settings.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">4.4 Refund Policy</h3>
              <p>
                We offer a 7-day money-back guarantee for first-time subscribers. After this period, all subscription fees are non-refundable. We reserve the right to issue refunds on a case-by-case basis at our sole discretion.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">4.5 Price Changes</h3>
              <p>
                We reserve the right to modify our pricing at any time. Price changes will not affect your current subscription period but will apply to subsequent renewals. We will provide advance notice of any price changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. User Responsibilities and Conduct</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">5.1 Accurate Information</h3>
              <p>
                You agree to provide accurate, truthful, and up-to-date information in your resume, profile, and job applications. You are solely responsible for the content you submit through our Service.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">5.2 Prohibited Uses</h3>
              <p className="mb-3">You agree NOT to use the Service to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide false, misleading, or fraudulent information</li>
                <li>Violate any applicable laws, regulations, or third-party rights</li>
                <li>Spam employers or submit applications to positions you are not qualified for</li>
                <li>Reverse engineer, decompile, or attempt to extract source code from our Service</li>
                <li>Use automated systems (other than our authorized features) to access the Service</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Impersonate another person or misrepresent your affiliation with any entity</li>
                <li>Collect or harvest personal information of other users</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">5.3 Application Accuracy</h3>
              <p>
                While we use AI to assist with applications, you are responsible for reviewing and verifying all information before submission. We recommend reviewing applications in the "Review Applications" section when available.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Intellectual Property Rights</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">6.1 Our Content</h3>
              <p>
                The Service, including all content, features, and functionality, is owned by Odanta LLC and is protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written permission.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">6.2 Your Content</h3>
              <p>
                You retain ownership of your resume, cover letters, and other content you upload to the Service. By uploading content, you grant us a worldwide, non-exclusive, royalty-free license to use, store, process, and display your content solely for the purpose of providing and improving our Service.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">6.3 Feedback</h3>
              <p>
                Any feedback, suggestions, or ideas you provide about the Service become our property, and we may use them without any obligation to you.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Service Availability and Modifications</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">7.1 Service Availability</h3>
              <p>
                We strive to provide uninterrupted access to our Service but do not guarantee that the Service will be available at all times. We may experience downtime for maintenance, updates, or due to factors beyond our control.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">7.2 Modifications to Service</h3>
              <p>
                We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with or without notice. We will not be liable to you or any third party for any modification, suspension, or discontinuation of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Disclaimers and Limitations of Liability</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">8.1 No Employment Guarantee</h3>
              <p>
                We do not guarantee that using our Service will result in job offers, interviews, or employment. Job search outcomes depend on many factors beyond our control, including your qualifications, the job market, and employer decisions.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">8.2 Third-Party Job Listings</h3>
              <p>
                Job listings are sourced from third-party websites and platforms. We do not verify the accuracy, legitimacy, or quality of job postings. You should conduct your own due diligence before applying to any position.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">8.3 AI-Generated Content</h3>
              <p>
                Our Service uses artificial intelligence to generate and optimize content. While we strive for accuracy, AI-generated content may contain errors or inaccuracies. You are responsible for reviewing and verifying all content before use.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">8.4 "AS IS" Basis</h3>
              <p className="uppercase font-semibold mb-2">
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">8.5 Limitation of Liability</h3>
              <p className="uppercase font-semibold">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, ODANTA LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM: (A) YOUR USE OR INABILITY TO USE THE SERVICE; (B) ANY UNAUTHORIZED ACCESS TO OR USE OF YOUR DATA; (C) ANY ERRORS OR OMISSIONS IN CONTENT; OR (D) ANY CONDUCT OF THIRD PARTIES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless Odanta LLC, its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses (including legal fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any rights of another party; or (d) any content you submit through the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Privacy</h2>
              <p>
                Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy to understand how we collect, use, and protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Termination</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">11.1 Termination by You</h3>
              <p>
                You may terminate your account at any time by contacting us or using the account deletion feature in your settings. Upon termination, your subscription will continue until the end of the current billing period.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">11.2 Termination by Us</h3>
              <p>
                We reserve the right to suspend or terminate your account and access to the Service at any time, with or without cause or notice, including if we believe you have violated these Terms or engaged in fraudulent or illegal activity.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">11.3 Effect of Termination</h3>
              <p>
                Upon termination, your right to use the Service will immediately cease. We may delete your data in accordance with our Privacy Policy and data retention policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Dispute Resolution</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">12.1 Governing Law</h3>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">12.2 Arbitration</h3>
              <p>
                Any dispute arising from these Terms or your use of the Service shall be resolved through binding arbitration in accordance with the American Arbitration Association rules, rather than in court, except that you may assert claims in small claims court if your claims qualify.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">12.3 Class Action Waiver</h3>
              <p>
                You agree that any arbitration or proceeding shall be limited to the dispute between you and us individually. You waive any right to participate in a class action lawsuit or class-wide arbitration.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. General Provisions</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">13.1 Entire Agreement</h3>
              <p>
                These Terms, together with our Privacy Policy, constitute the entire agreement between you and Odanta LLC regarding the Service.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">13.2 Severability</h3>
              <p>
                If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will remain in full force and effect.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">13.3 Waiver</h3>
              <p>
                Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">13.4 Assignment</h3>
              <p>
                You may not assign or transfer these Terms or your account without our prior written consent. We may assign our rights and obligations without restriction.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">13.5 Changes to Terms</h3>
              <p>
                We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on our website and updating the "Last Updated" date. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Contact Information</h2>
              <p className="mb-3">
                If you have any questions, concerns, or disputes regarding these Terms of Service, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold">Odanta LLC</p>
                <p>ResumeMax.ai</p>
                <p>Email: support@resumemax.ai</p>
                <p>Legal: legal@resumemax.ai</p>
                <p>Website: <a href="https://resumemax.ai" className="text-blue-600 hover:underline">https://resumemax.ai</a></p>
              </div>
            </section>

            <section className="border-t border-gray-200 pt-6 mt-8">
              <p className="text-sm text-gray-600 italic">
                By using ResumeMax.ai, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/80 backdrop-blur-sm mt-12">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-sm text-gray-600">
          <p>&copy; {new Date().getFullYear()} Odanta LLC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
