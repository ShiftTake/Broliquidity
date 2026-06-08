import React from "react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050816] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
          <Link href="/" className="rounded-xl border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-200 hover:text-[#b6ff22]">
            Back Home
          </Link>
        </div>

        <p className="text-sm text-slate-300">Effective date: 2026-06-08</p>

        <div className="mt-6 space-y-6 text-sm leading-7 text-slate-200">
          <section>
            <h2 className="text-lg font-black text-white">What We Collect</h2>
            <p>We collect account information such as email, display name, profile data, content you post, follow relationships, and direct message metadata needed to operate the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">How We Use Data</h2>
            <p>Data is used to authenticate users, display content, provide social features, detect abuse, maintain reliability, and improve product quality.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Data Sharing</h2>
            <p>We do not sell personal data. Service providers may process data to host infrastructure, analytics, and security operations on our behalf.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Your Controls</h2>
            <p>You can edit profile details, manage visibility through in-app controls, and request account deletion from your profile page.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Retention</h2>
            <p>We retain data only as long as needed for service operation, legal obligations, and security investigations.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Contact</h2>
            <p>If you have questions about privacy, contact support through official Bro Liquidity support channels.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
