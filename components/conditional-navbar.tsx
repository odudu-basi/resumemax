"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";

export function ConditionalNavbar() {
  const pathname = usePathname();
  const hiddenNavbarPaths = ['/dashboard'];
  const shouldShowNavbar = !hiddenNavbarPaths.includes(pathname);

  if (!shouldShowNavbar) {
    return null;
  }

  return <Navbar />;
}
