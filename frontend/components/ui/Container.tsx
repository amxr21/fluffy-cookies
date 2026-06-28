import { cn } from "@/lib/utils";

type ContainerProps<T extends React.ElementType> = {
  as?: T;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/**
 * Full-width page wrapper with consistent horizontal gutters.
 * No max-width cap — the layout spans the full viewport like the design.
 * Reused by the navbar, footer, and every section so gutters stay aligned.
 */
export function Container<T extends React.ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: ContainerProps<T>) {
  const Tag = as ?? "div";
  return (
    <Tag className={cn(className, "mx-auto w-full px-6 md:px-32" )} {...rest}>
      {children}
    </Tag>
  );
}
