import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowMind — Finanzas Personales",
  description:
    "Gestiona tus finanzas personales con inteligencia artificial. Registra gastos, crea presupuestos y alcanza tus metas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
