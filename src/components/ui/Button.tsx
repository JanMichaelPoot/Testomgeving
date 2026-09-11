import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "px-5 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-3.5 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-50";

const variants = {
  // The gold ring is a deliberate, small "foil edge" touch on the site's
  // one most-repeated interactive element, echoing the Idea Book PDF's
  // gold-foil borders without needing gold anywhere near body text.
  primary:
    "bg-accent text-white shadow-[0_0_0_1.5px_var(--color-gold),0_4px_16px_rgba(14,107,79,0.25)] hover:bg-accent-dark hover:shadow-[0_0_0_1.5px_var(--color-gold),0_6px_24px_rgba(14,107,79,0.35)]",
  secondary: "bg-paper text-accent-dark border border-accent/15 shadow-sm hover:shadow-md hover:border-accent/30",
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
