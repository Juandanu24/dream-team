import type { Metadata, Viewport } from "next";
import { Archivo, Bebas_Neue } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

export const metadata: Metadata = {
  title: {
    default: "Dream Team — Torneo Relámpago",
    template: "%s | Dream Team",
  },
  description:
    "Un torneo. Un equipo. Un sueño. El torneo relámpago de fútbol del Dream Team: 4 equipos, fase de grupos, semifinales y gran final.",
  appleWebApp: {
    capable: true,
    title: "Dream Team",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${archivo.variable} ${bebas.variable} bg-stadium min-h-dvh font-sans antialiased`}
      >
        {children}
        <Toaster position="top-center" richColors />
        <SwRegister />
      </body>
    </html>
  );
}
