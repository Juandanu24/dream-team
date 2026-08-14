"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

type Kind = "months" | "years" | "founder" | "cofounder";

const KIND_LABELS: Record<Kind, string> = {
  months: "Meses",
  years: "Años",
  founder: "Founder",
  cofounder: "Cofounder",
};

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

function parse(value: string | undefined): { kind: Kind; amount: number } {
  if (!value) return { kind: "months", amount: 6 };
  const v = value.trim().toLowerCase();
  if (v.startsWith("cofounder")) return { kind: "cofounder", amount: 1 };
  if (v.startsWith("founder")) return { kind: "founder", amount: 1 };
  const match = v.match(/^(\d+)\s*(mes|año)/);
  if (match) {
    return {
      kind: match[2] === "año" ? "years" : "months",
      amount: Number(match[1]),
    };
  }
  return { kind: "months", amount: 6 };
}

export function composeMemberSince(kind: Kind, amount: number): string {
  if (kind === "founder") return "Founder";
  if (kind === "cofounder") return "Cofounder";
  if (kind === "years") return amount === 1 ? "1 año" : `${amount} años`;
  return amount === 1 ? "1 mes" : `${amount} meses`;
}

interface MemberSinceFieldProps {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  idPrefix?: string;
}

// Tiempo en el Dream Team estructurado: cantidad + meses/años, o
// Founder/Cofounder. Emite el texto compuesto ("2 años", "Founder")
// en un input oculto para forms y por onValueChange para previews.
export function MemberSinceField({
  defaultValue,
  onValueChange,
  name = "member_since",
  idPrefix = "ms",
}: MemberSinceFieldProps) {
  const initial = parse(defaultValue);
  const [kind, setKind] = useState<Kind>(initial.kind);
  const [amount, setAmount] = useState<number>(initial.amount);

  const value = composeMemberSince(kind, amount);
  const showAmount = kind === "months" || kind === "years";

  function update(nextKind: Kind, nextAmount: number) {
    setKind(nextKind);
    setAmount(nextAmount);
    onValueChange?.(composeMemberSince(nextKind, nextAmount));
  }

  return (
    <div className="flex gap-2">
      {showAmount ? (
        <Input
          id={`${idPrefix}-amount`}
          type="number"
          min={1}
          max={99}
          value={amount}
          onChange={(e) => update(kind, Number(e.target.value) || 1)}
          className="w-20"
          aria-label="Cantidad"
          required
        />
      ) : null}
      <select
        id={`${idPrefix}-kind`}
        value={kind}
        onChange={(e) => update(e.target.value as Kind, amount)}
        className={`${selectClass} flex-1`}
        aria-label="Tiempo en el Dream Team"
      >
        {Object.entries(KIND_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
