"use client";

import { useState, useEffect, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface PriceInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  valueCents: number;
  onChange: (cents: number) => void;
}

/**
 * A fully free-typing dollar amount input.
 * Stores raw string while focused; converts to cents on blur.
 * Prevents the "cursor jumps" issue caused by toFixed() round-trips.
 */
export function PriceInput({ valueCents, onChange, className, ...props }: PriceInputProps) {
  const [raw, setRaw] = useState(() => (valueCents > 0 ? (valueCents / 100).toFixed(2) : ""));
  const [focused, setFocused] = useState(false);

  // Sync incoming value only when not actively editing (e.g. OCR fills data)
  useEffect(() => {
    if (!focused) {
      setRaw(valueCents > 0 ? (valueCents / 100).toFixed(2) : "");
    }
  }, [valueCents, focused]);

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={raw}
      className={cn(
        "bg-transparent outline-none text-right tabular-nums",
        className
      )}
      onChange={(e) => {
        const val = e.target.value;
        // Allow digits, one dot, and leading minus (for display only; clamp below)
        if (/^-?\d*\.?\d{0,2}$/.test(val) || val === "" || val === ".") {
          setRaw(val);
          const num = parseFloat(val);
          onChange(isNaN(num) || num < 0 ? 0 : Math.round(num * 100));
        }
      }}
      onFocus={(e) => {
        setFocused(true);
        // Select all on focus for easy replacement
        e.target.select();
      }}
      onBlur={() => {
        setFocused(false);
        const num = parseFloat(raw);
        if (isNaN(num) || num < 0) {
          setRaw("");
          onChange(0);
        } else {
          setRaw(num.toFixed(2));
          onChange(Math.round(num * 100));
        }
      }}
    />
  );
}
