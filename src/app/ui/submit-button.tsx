"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";

export function SubmitButton({ children, disabled, ...props }: ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return <button {...props} type="submit" disabled={disabled || pending} aria-busy={pending}>{pending ? "Please wait..." : children}</button>;
}
