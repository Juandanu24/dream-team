import type { Metadata, Viewport } from "next";
import { Archivo, Bebas_Neue } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SwRegister } from "@/components/sw-register";
import { ThemeProvider } from "@/components/theme-provider";
import { getActiveTournamentName } from "@/lib/data";
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

// Sin formato en la descripción a propósito. Antes decía "4 equipos,
// fase de grupos, semifinales y gran final", que era el torneo 1: esto
// es lo que ve quien recibe el link por WhatsApp, y el formato del
// siguiente torneo depende de cuántos equipos entren.
const DESCRIPTION =
  "Un torneo. Un equipo. Un sueño. Fútbol 9 del Dream Team en Montería: tabla en vivo, goleadores, alineaciones y la carta de cada jugador.";

const TITULO_POR_DEFECTO = "Dream Team — Fútbol 9 en Montería";

/** El título sale del nombre del torneo activo, igual que el cartel del
 *  hero, para que no haya que acordarse de cambiarlo a mano cuando
 *  arranque el siguiente. Si Supabase no responde queda el genérico:
 *  mejor eso que anunciar un torneo que ya pasó. */
export async function generateMetadata(): Promise<Metadata> {
  const nombre = await getActiveTournamentName();
  const title = nombre ? `Dream Team — ${nombre}` : TITULO_POR_DEFECTO;

  return {
  // Sin metadataBase las URLs de Open Graph salen relativas y WhatsApp
  // e Instagram no logran cargar la imagen de vista previa.
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: "%s | Dream Team",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Dream Team",
    locale: "es_CO",
    url: SITE_URL,
    title,
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${title} · Montería`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Dream Team",
    statusBarStyle: "black-translucent",
    },
  };
}

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
