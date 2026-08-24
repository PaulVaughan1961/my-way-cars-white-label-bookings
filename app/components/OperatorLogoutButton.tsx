"use client";

import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function OperatorLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await getSupabase().auth.signOut();
    router.replace("/operator-login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900"
    >
      Sign out
    </button>
  );
}
