import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind class name combiner (used by the shadcn-style UI components).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

