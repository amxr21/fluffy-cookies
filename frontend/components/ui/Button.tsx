import { cn } from "@/lib/utils";

type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  variant?: "solid" | "outline";
  fullWidth?: boolean;
};

/** Brand button — soft-rounded (never fully rounded), navy by default. */
export function Button({
  variant = "solid",
  fullWidth,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-lg px-2 py-1.5 text-small font-extralight uppercase tracking-wide",
        "transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
        "motion-reduce:transform-none motion-reduce:transition-colors",
        variant === "solid" &&
          "bg-navy text-white hover:bg-navy/90 hover:shadow-lg hover:shadow-navy/25",
        variant === "outline" &&
          "border border-navy/40 text-navy hover:border-navy hover:bg-navy/5",
        fullWidth && "w-full",
        className
      )}
      {...props}
    />
  );
}
