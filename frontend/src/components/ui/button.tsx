// frontend/src/components/ui/button.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

/**
 * Map variant -> CSS class defined in global.css
 * - "default" intentionally maps to the primary visual style for backward compatibility.
 */
const variantClassMap: Record<ButtonVariant, string> = {
  default: "btn-primary",
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "bg-transparent",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", children, ...props }, ref) => {
    const variantClass = variantClassMap[variant] || variantClassMap.default;
    const sizeClass = sizeClassMap[size] || sizeClassMap.md;

    return (
      <button
        ref={ref}
        className={cn("btn", variantClass, sizeClass, className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
