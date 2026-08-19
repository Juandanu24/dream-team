import type { Metadata, Viewport } from "next";
import { Archivo, Bebas_Neue } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SwRegister } from "@/components/sw-register";
import { ThemeProvider } from "@/components/theme-provider";
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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://dreamteamcolombia.vercel.app";

const DESCRIPTION =
  "Un torneo. Un equipo. Un sueño. El 1er Torneo Amistoso de fútbol del Dream Team: 4 equipos, fase de grupos, semifinales y gran final.";

export const metadata: Metadata = {
  // Sin metadataBase las URLs de Open Graph salen relativas y WhatsApp
  // e Instagram no logran cargar la imagen de vista previa.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dream Team — 1er Torneo Amistoso",
    template: "%s | Dream Team",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Dream Team",
    locale: "es_CO",
    url: SITE_URL,
    title: "Dream Team — 1er Torneo Amistoso",
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Dream Team · 1er Torneo Amistoso · Montería",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dream Team — 1er Torneo Amistoso",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Dream Team",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${archivo.variable} ${bebas.variable} bg-stadium min-h-dvh font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" richColors />
          <SwRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
