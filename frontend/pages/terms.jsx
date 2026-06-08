import React from "react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050816] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-black tracking-tight">Terms of Service</h1>
          <Link href="/" className="rounded-xl border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-200 hover:text-[#b6ff22]">
            Back Home
          </Link>
        </div>

        <p className="text-sm text-slate-300">Effective date: 2026-06-08</p>

        <div className="mt-6 space-y-6 text-sm leading-7 text-slate-200">
          <section>
            <h2 className="text-lg font-black text-white">Use of Service</h2>
            <p>You agree to use Bro Liquidity responsibly and comply with applicable laws. Do not post unlawful, fraudulent, or abusive content.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Account Responsibility</h2>
            <p>You are responsible for safeguarding your credentials and for activity under your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">User Content</h2>
            <p>You retain ownership of your content. By posting, you grant Bro Liquidity a license to display and distribute that content within the platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Moderation</h2>
            <p>We may remove content or suspend accounts that violate these terms or threaten user safety.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Disclaimers</h2>
            <p>Content is for informational purposes only and is not financial, legal, or tax advice.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-white">Termination</h2>
            <p>You may stop using the service at any time. You can delete your account from within the app.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
