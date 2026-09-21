import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, with later Tailwind utilities winning over earlier ones.
 * This is what lets a component expose a `className` prop that can genuinely
 * override its own defaults rather than fighting them on specificity.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
