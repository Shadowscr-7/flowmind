import React from "react";

// Simple passthrough — landing page at / has no app shell
export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
