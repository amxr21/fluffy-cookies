"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Branded form controls — Input, Textarea and the shared Field wrapper.
 *
 * Replaces the bare `<input className="fluffy-field">` pattern: every field now
 * gets a properly associated label, an optional-vs-required marker, hint and
 * error slots wired through `aria-describedby` / `aria-invalid`, and consistent
 * Fluffy styling (soft-rounded, navy focus ring — never the browser default).
 */

type FieldShellProps = {
  label: string;
  /** Shown under the control until an error replaces it. */
  hint?: string;
  error?: string;
  /** Marks the field visually + for assistive tech. */
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
};

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex items-center gap-1 text-small text-navy/80">
        {label}
        {required ? (
          <span aria-hidden className="text-brown">
            *
          </span>
        ) : (
          <span className="text-caption text-navy/40">(optional)</span>
        )}
      </label>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error ? (
        <p id={errorId} className="text-caption font-medium text-brown">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-navy/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Shared control styling — soft-rounded, navy focus ring, brown error state. */
const controlClass = (invalid: boolean) =>
  cn(
    "w-full rounded-lg border bg-white px-3 py-2.5 text-body text-navy",
    "transition-[border-color,box-shadow] duration-200",
    "placeholder:text-navy/35",
    "focus:outline-none focus-visible:ring-3",
    invalid
      ? "border-brown focus-visible:border-brown focus-visible:ring-brown/25"
      : "border-navy/25 hover:border-navy/45 focus-visible:border-navy focus-visible:ring-navy/20",
    "disabled:cursor-not-allowed disabled:bg-navy/5 disabled:text-navy/40"
  );

type InputProps = Omit<React.ComponentPropsWithoutRef<"input">, "id"> &
  Omit<FieldShellProps, "children">;

export function Input({
  label,
  hint,
  error,
  required,
  className,
  ...props
}: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          {...props}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={controlClass(invalid)}
        />
      )}
    </Field>
  );
}

type TextareaProps = Omit<React.ComponentPropsWithoutRef<"textarea">, "id"> &
  Omit<FieldShellProps, "children">;

export function Textarea({
  label,
  hint,
  error,
  required,
  className,
  ...props
}: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...props}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClass(invalid), "resize-none")}
        />
      )}
    </Field>
  );
}
