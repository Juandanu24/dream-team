import type { Metadata } from "next";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: "Inscripción",
};

export default function RegistrationPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
        SUMA TU <span className="text-volt">NOMBRE</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Llena tus datos como si fuera tu carta de FIFA: la vas a ver armarse en
        vivo. Cuando los organizadores aprueben tu inscripción, quedas oficial
        en el torneo.
      </p>
      <div className="mt-10">
        <RegistrationForm />
      </div>
    </div>
  );
}
