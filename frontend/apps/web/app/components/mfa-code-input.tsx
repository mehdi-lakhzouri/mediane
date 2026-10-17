"use client";

import { motion, useReducedMotion } from "framer-motion";
import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from "input-otp";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";

const messages = defineMessages({
  en: { label: "Six-digit authentication code" },
  fr: { label: "Code d’authentification à six chiffres" },
});

interface MfaCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  variant?: "security" | "settings";
}

function CodeSlot({
  char,
  placeholderChar,
  isActive,
  hasFakeCaret,
  hasError,
  variant,
}: SlotProps & { hasError: boolean; variant: "security" | "settings" }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={
        reduceMotion
          ? undefined
          : { y: char ? -1 : 0, scale: isActive ? 1.035 : 1 }
      }
      transition={{ type: "spring", stiffness: 360, damping: 24 }}
      className={`mfa-code-slot ${variant === "settings" ? "settings-code-slot" : ""} ${isActive ? "is-active" : ""} ${hasError ? "has-error" : ""}`}
    >
      <span className="relative z-10">{char ?? placeholderChar}</span>
      {hasFakeCaret && <span className="mfa-code-caret" aria-hidden="true" />}
    </motion.div>
  );
}

export function MfaCodeInput({
  value,
  onChange,
  disabled = false,
  hasError = false,
  autoFocus = false,
  variant = "security",
}: MfaCodeInputProps) {
  const t = useMessages(messages);
  return (
    <OTPInput
      name="verification-code"
      value={value}
      onChange={onChange}
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      disabled={disabled}
      required
      aria-label={t.label}
      aria-invalid={hasError}
      containerClassName={`mfa-code-group ${variant === "settings" ? "settings-code-group" : ""}`}
      render={({ slots }) => (
        <div className="flex w-full items-center justify-center gap-2 sm:gap-3">
          {slots.map((slot, index) => (
            <CodeSlot
              key={index}
              {...slot}
              hasError={hasError}
              variant={variant}
            />
          ))}
        </div>
      )}
    />
  );
}
