import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0f12] p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img
            src="/images/logo.png"
            alt="FlowMind"
            className="h-12 w-12 object-contain drop-shadow-lg"
          />
          <span className="text-2xl font-black tracking-tight text-white">
            FlowMind
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
