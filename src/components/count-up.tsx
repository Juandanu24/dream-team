"use client";

import { useEffect, useRef, useState } from "react";

/** Un número que sube desde cero cuando entra en pantalla.
 *
 *  El HTML que se sirve trae ya la cifra final: el home es estático y
 *  se indexa, así que un "0" horneado sería mentir en la fuente. La
 *  animación solo arranca si el elemento está FUERA de la ventana al
 *  montar. Si ya se ve —pantalla grande, sección sobre el pliegue—
 *  se queda con su valor: bajarlo a cero después del primer pintado
 *  haría un parpadeo peor que no animar. */
export function CountUp({
  to,
  duration = 1100,
  delay = 0,
  className,
}: {
  to: number;
  /** Cuánto tarda en llegar, en ms. */
  duration?: number;
  /** Para escalonar varios contadores vecinos. */
  delay?: number;
  className?: string;
}) {
  const [value, setValue] = useState(to);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const caja = el.getBoundingClientRect();
    if (caja.top < window.innerHeight && caja.bottom > 0) return;

    setValue(0);

    let raf = 0;
    let timer = 0;

    const correr = () => {
      const inicio = performance.now();
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - inicio) / duration);
        // Ease-out cúbica: frena al final, como un marcador que cuadra.
        setValue(Math.round(to * (1 - (1 - t) ** 3)));
        if (t < 1) raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
    };

    const observer = new IntersectionObserver(
      ([entrada], obs) => {
        if (!entrada.isIntersecting) return;
        obs.disconnect();
        timer = window.setTimeout(correr, delay);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [to, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
