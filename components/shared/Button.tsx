import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "md" | "sm";

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary:
    "bg-bg-raised text-text-primary border border-border-strong hover:border-[#3A3D44] hover:bg-[#1E2025]",
  ghost: "bg-transparent text-text-tertiary hover:bg-bg-raised hover:text-text-primary",
  destructive: "bg-transparent text-danger-text border border-[#3A2A2C] hover:bg-[#1E1618]",
};

const sizeClasses: Record<Size, string> = {
  md: "text-sm px-[18px] py-2.5",
  sm: "text-ui px-3.5 py-1.5",
};

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-btn font-medium transition-colors disabled:cursor-not-allowed disabled:pointer-events-none disabled:border-transparent disabled:bg-[#1D1E22] disabled:text-text-faint cursor-pointer";

interface ButtonOwnProps {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
  className?: string;
}

type ButtonAsButton = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps> & { href?: undefined };
type ButtonAsLink = ButtonOwnProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonOwnProps> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  const classes = [base, variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(" ");

  if (props.href !== undefined) {
    const { href, children, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { children, ...rest } = props;
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
