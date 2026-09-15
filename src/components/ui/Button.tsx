import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "px-5 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-3.5 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-50";

const variants = {
  // Clean Premium Hybrid: no heavy shadows or "AI glow" — a flat fill and a
  // 1px border are the only two states, per the current design system.
  primary: "bg-ink text-white hover:bg-accent-dark",
  secondary: "bg-paper text-ink border border-border hover:border-ink/30",
  ghost: "text-ink hover:bg-ink/5",
};

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

type LinkVariantProps = { href: string } & Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "href"
>;
type ButtonVariantProps = { href?: undefined } & ComponentPropsWithoutRef<"button">;

type ButtonProps = { variant?: Variant; size?: Size } & (
  | LinkVariantProps
  | ButtonVariantProps
);

export function Button({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: ButtonProps) {
  const classes = cn(base, sizes[size], variants[variant], className);

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        {...(props as Omit<ComponentPropsWithoutRef<typeof Link>, "href">)}
      />
    );
  }

  return (
    <button
      className={classes}
      {...(props as ComponentPropsWithoutRef<"button">)}
    />
  );
}
