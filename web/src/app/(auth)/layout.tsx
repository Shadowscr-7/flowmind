import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img
            src="/images/logo.png"
            alt="FlowMind"
            className="h-12 w-12 object-contain drop-shadow-lg"
          />
          <span
            className="font-extrabold text-2xl tracking-tight"
            style={{
              background: "linear-gradient(135deg, #a5b4fc 0%, #818cf8 40%, #67e8f9 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            FlowMind
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
