import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowMind — Finanzas Personales con IA",
  description:
    "Gestioná tus finanzas personales con inteligencia artificial. Registrá gastos por WhatsApp, web o app móvil. Todo sincronizado en tiempo real.",
  icons: {
    icon: [
      { url: "/images/logo.png", type: "image/png" },
    ],
    apple: "/images/logo.png",
    shortcut: "/images/logo.png",
  },
  openGraph: {
    title: "FlowMind — Finanzas Personales con IA",
    description: "Registrá gastos por WhatsApp, web o app. Todo sincronizado con IA.",
    images: [{ url: "/images/logo.png" }],
  },
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
