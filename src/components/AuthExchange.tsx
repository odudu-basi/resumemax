"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/src/lib/supabase";

export default function AuthExchange() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const supabase = createSupabaseClient();
    const returnTo = params.get("returnTo") || "/dashboard";

    (async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          // Keep URL visible for debugging, but log the issue
          console.error("Auth code exchange failed", error.message);
          return;
        }
        // Clean the URL (remove code param) and redirect
        window.history.replaceState({}, document.title, window.location.pathname);
        router.replace(returnTo);
      } catch (e) {
        console.error("Auth exchange exception", e);
      }
    })();
  }, [router]);

  return null;
}


