import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary: "bg-accent text-white shadow-sm hover:bg-accent-dark",
  secondary: "bg-paper text-ink shadow-sm hover:bg-ink/5",
  ghost: "text-ink hover:bg-ink/5",
};

type Variant = keyof typeof variants;

type LinkVariantProps = { href: string } & Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "href"
>;
type ButtonVariantProps = { href?: undefined } & ComponentPropsWithoutRef<"button">;

type ButtonProps = { variant?: Variant } & (
  | LinkVariantProps
  | ButtonVariantProps
);

export function Button({
  variant = "primary",
  className,
  href,
  ...props
}: ButtonProps) {
  const classes = cn(base, variants[variant], className);

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
