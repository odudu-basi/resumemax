const { clsx } = require("clsx")
const { twMerge } = require("tailwind-merge")

type ClassValue = string | number | boolean | undefined | null | { [key: string]: any } | ClassValue[]

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
