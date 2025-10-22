"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";

export function ConditionalNavbar() {
  const pathname = usePathname();
  const hiddenNavbarPaths = ['/dashboard', '/create-resume', '/tailor-resume'];
  const shouldShowNavbar = !hiddenNavbarPaths.some(path => pathname.startsWith(path));

  if (!shouldShowNavbar) {
    return null;
  }

  return <Navbar />;
}
