"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

// Tabs cuyo estado vive en la URL (?tab=calendario). Así se pueden
// mandar links directos a una pestaña y el botón atrás funciona.
export function SyncedTabs({
  tabs,
  defaultTab,
  param = "tab",
  className,
  children,
}: {
  /** Valores válidos; cualquier otra cosa en la URL cae al default. */
  tabs: string[];
  defaultTab: string;
  param?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromUrl = searchParams.get(param);
  const value = fromUrl && tabs.includes(fromUrl) ? fromUrl : defaultTab;

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams);
        if (next === defaultTab) params.delete(param);
        else params.set(param, next);
        const query = params.toString();
        // scroll: false para que no salte al inicio al cambiar de tab.
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      }}
      className={className}
    >
      {children}
    </Tabs>
  );
}
