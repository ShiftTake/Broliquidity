import React from "react";
import Link from "next/link";

export default function CommunityGuidelinesPage() {
  return (
    <div className="min-h-screen bg-[#050816] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-black tracking-tight">Community Guidelines</h1>
          <Link href="/" className="rounded-xl border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-200 hover:text-[#b6ff22]">
            Back Home
          </Link>
        </div>

        <p className="text-sm text-slate-300">Effective date: 2026-06-08</p>

        <div className="mt-6 space-y-6 text-sm leading-7 text-slate-200">
          <section>
            <h2 className="text-lg font-black text-white">Respectful Conduct</h2>
            <p>Debate ideas, not people. Harassment, threats, hate speech, and targeted abuse are not allowed.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Market and Trade Content</h2>
            <p>Share opinions and analysis responsibly. Do not post fraudulent claims, impersonations, or market manipulation content.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Safety and Privacy</h2>
            <p>Do not publish private personal information, account credentials, or confidential employer/client material.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Reporting and Enforcement</h2>
            <p>Users can report violating content. We may remove content, limit features, or suspend accounts for violations.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Financial Disclaimer</h2>
            <p>Platform content is for educational and informational discussion only and does not constitute investment advice.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
