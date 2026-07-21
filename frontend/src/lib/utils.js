import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatPropertyAddress({ street, house_number, postal_code, city }) {
  return `${street} ${house_number}, ${postal_code} ${city}`;
}
