import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "min-h-11 px-5 text-sm",
  md: "min-h-12 px-6 text-sm",
  lg: "min-h-12 px-8 text-base",
};

// Every primary/secondary action shares one consistent height (48px, "md"
// and "lg" both min-h-12) regardless of size variant, so a Terug/Verder
// pair — or any two buttons on the same row — always lines up on the same
// baseline instead of drifting with each button's own text size.
const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/35 focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-50";

const variants = {
  // Deep walnut fill with a restrained gold accent that only appears on
  // hover/focus — gold stays a highlight, never a fill or body-text color.
  primary:
    "bg-accent-dark text-paper border border-accent-dark hover:bg-accent hover:border-gold hover:shadow-[0_6px_18px_rgba(60,41,32,0.18)]",
  secondary:
    "bg-cream text-accent-dark border border-border hover:border-walnut-light hover:bg-surface-active",
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
