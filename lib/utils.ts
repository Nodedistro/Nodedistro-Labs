import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function uid() {
  return crypto.randomUUID();
}
export function download(
  name: string,
  data: string | Blob,
  mime = "application/json",
) {
  const url = URL.createObjectURL(
    data instanceof Blob ? data : new Blob([data], { type: mime }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}
