import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function Community() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/communities");
  }, [router]);

  return (
    <div className="min-h-screen bg-white px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">Redirecting to Communities</h1>
        <p className="mt-3 text-sm text-slate-500">Community feeds are available in the main directory and per-community pages.</p>
        <Link href="/communities" className="mt-6 inline-flex rounded-2xl bg-brogreen px-5 py-3 font-black text-black">
          Open Communities
        </Link>
      </div>
    </div>
  );
}
