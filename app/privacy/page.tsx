"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <div className="space-y-8 text-gray-700">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p>
                Welcome to ResumeMax.ai ("we," "our," or "us"), operated by Odanta LLC. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services at resumemax.ai (the "Service").
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">2.1 Personal Information</h3>
              <p className="mb-3">We collect personal information that you voluntarily provide to us, including but not limited to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Full name, email address, and phone number</li>
                <li>Resume and professional information (work history, education, skills)</li>
                <li>Job search preferences and career objectives</li>
                <li>Demographic information (when required for job applications)</li>
                <li>LinkedIn profile and portfolio URLs</li>
                <li>Work authorization status</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">2.2 Automatically Collected Information</h3>
              <p className="mb-3">When you use our Service, we automatically collect certain information, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Device information (IP address, browser type, operating system)</li>
                <li>Usage data (pages visited, time spent, features used)</li>
                <li>Cookies and similar tracking technologies</li>
                <li>Analytics data to improve our Service</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">2.3 Third-Party Information</h3>
              <p className="mb-3">We may receive information from third-party services you connect to our platform, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Authentication providers (Google, email verification services)</li>
                <li>Payment processors (Stripe) for subscription management</li>
                <li>Job listing platforms and application tracking systems</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="mb-3">We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, operate, and maintain our Service</li>
                <li>Process your job applications and submit them on your behalf</li>
                <li>Tailor resumes and cover letters to job requirements</li>
                <li>Search for and match you with relevant job opportunities</li>
                <li>Communicate with you about your account and service updates</li>
                <li>Process payments and manage subscriptions</li>
                <li>Analyze usage patterns to improve our Service</li>
                <li>Detect, prevent, and address technical issues and fraud</li>
                <li>Comply with legal obligations and enforce our Terms of Service</li>
                <li>Send you marketing communications (with your consent)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Information Sharing and Disclosure</h2>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">4.1 Job Applications</h3>
              <p>
                We share your resume, cover letter, and application information with potential employers when you use our automated job application feature. This is a core function of our Service and necessary to help you find employment.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">4.2 Service Providers</h3>
              <p className="mb-3">We may share your information with third-party service providers who perform services on our behalf, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Cloud hosting providers (Vercel, Supabase)</li>
                <li>Payment processors (Stripe)</li>
                <li>Analytics services (Mixpanel)</li>
                <li>AI and automation services (OpenAI, Anthropic)</li>
                <li>Email service providers</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">4.3 Legal Requirements</h3>
              <p>
                We may disclose your information if required by law, court order, or governmental regulation, or if we believe such action is necessary to comply with legal obligations, protect our rights, or ensure the safety of our users.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-4 mb-2">4.4 Business Transfers</h3>
              <p>
                In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change and provide choices regarding your information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Security</h2>
              <p className="mb-3">
                We implement industry-standard security measures to protect your personal information, including:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security audits and monitoring</li>
                <li>Limited employee access to personal data</li>
              </ul>
              <p className="mt-3">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to provide our Service, comply with legal obligations, resolve disputes, and enforce our agreements. When you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain it by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Privacy Rights</h2>
              <p className="mb-3">Depending on your location, you may have the following rights:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Access:</strong> Request access to the personal information we hold about you</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Portability:</strong> Request a copy of your data in a portable format</li>
                <li><strong>Opt-out:</strong> Opt out of marketing communications at any time</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent for data processing where applicable</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, please contact us at privacy@resumemax.ai.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies and Tracking Technologies</h2>
              <p className="mb-3">
                We use cookies and similar tracking technologies to enhance your experience. You can control cookies through your browser settings. However, disabling cookies may limit your ability to use certain features of our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Children's Privacy</h2>
              <p>
                Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete such information promptly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. International Data Transfers</h2>
              <p>
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. By using our Service, you consent to such transfers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. California Privacy Rights</h2>
              <p>
                If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete personal information, and the right to opt-out of the sale of personal information. We do not sell personal information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. Your continued use of the Service after such changes constitutes acceptance of the updated Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Contact Us</h2>
              <p className="mb-3">
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold">Odanta LLC</p>
                <p>ResumeMax.ai</p>
                <p>Email: privacy@resumemax.ai</p>
                <p>Website: <a href="https://resumemax.ai" className="text-blue-600 hover:underline">https://resumemax.ai</a></p>
              </div>
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
