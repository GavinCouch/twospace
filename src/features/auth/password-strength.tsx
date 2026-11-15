"use client";

import { useEffect, useState } from "react";

const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"] as const;
type Estimate = { score: number; advice: string };

export function PasswordStrength({
  password,
  firstName,
  lastName,
  email,
}: {
  password: string;
  firstName: string;
  lastName: string;
  email: string;
}) {
  const [result, setResult] = useState<{
    input: string;
    estimate?: Estimate;
    failed?: boolean;
  } | null>(null);
  const input = JSON.stringify([password, firstName, lastName, email]);

  useEffect(() => {
    if (!password) return;
    let canceled = false;
    const timeout = setTimeout(async () => {
      try {
        const { estimatePassword } = await import("./password-estimate");
        if (canceled) return;
        const estimate = estimatePassword(password, [
          firstName,
          lastName,
          email,
        ]);
        setResult({ input, estimate });
      } catch {
        if (!canceled) setResult({ input, failed: true });
      }
    }, 200);
    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, [password, firstName, lastName, email, input]);

  const current = result?.input === input ? result : null;
  const estimate = current?.estimate;
  const label = !password
    ? ""
    : current?.failed
      ? "Strength estimate unavailable."
      : estimate
        ? `Estimated strength: ${labels[estimate.score]}`
        : "Checking strength…";

  return (
    <div className="auth-password-strength" id="signup-password-help">
      <p>Use at least 10 characters.</p>
      {password && (
        <>
          <div
            className="auth-strength-bars"
            role="meter"
            aria-label="Estimated password strength"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={estimate?.score ?? 0}
            aria-valuetext={label}
            data-score={estimate?.score}
          >
            {labels.map((_, index) => (
              <span
                key={index}
                data-filled={estimate ? index <= estimate.score : false}
              />
            ))}
          </div>
          <p aria-live="polite" aria-atomic="true">
            {label}
          </p>
          {estimate?.advice && (
            <p className="auth-password-advice">{estimate.advice}</p>
          )}
        </>
      )}
    </div>
  );
}
