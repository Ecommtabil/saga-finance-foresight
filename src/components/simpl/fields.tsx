import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
import { cn } from "@/lib/utils";

/** Input numérico tolerante a estados intermediários (inclusive "-" e vírgula). */
export function NumInput({
  value,
  onChange,
  className,
  step,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  step?: string;
  placeholder?: string;
}) {
  const [txt, setTxt] = useState(String(value ?? 0));
  useEffect(() => {
    const parsed = Number(txt.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed !== value) setTxt(String(value ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      inputMode="decimal"
      step={step}
      placeholder={placeholder}
      className={cn("h-8 text-right text-sm tabular-nums", className)}
      value={txt}
      onChange={(e) => {
        const v = e.target.value;
        setTxt(v);
        const parsed = Number(v.replace(",", "."));
        if (v.trim() !== "" && Number.isFinite(parsed)) onChange(parsed);
      }}
      onBlur={() => {
        const parsed = Number(txt.replace(",", "."));
        const final = Number.isFinite(parsed) ? parsed : 0;
        onChange(final);
        setTxt(String(final));
      }}
    />
  );
}

/** Campo em percentual: exibe 12,5 e devolve 0.125. */
export function PctInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <NumInput
      className={className}
      value={Math.round((value ?? 0) * 10000) / 100}
      onChange={(v) => onChange(v / 100)}
    />
  );
}

export function Campo({
  label,
  ajuda,
  children,
  className,
}: {
  label: string;
  ajuda?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {ajuda && <InfoTooltip text={ajuda} />}
      </Label>
      {children}
    </div>
  );
}
