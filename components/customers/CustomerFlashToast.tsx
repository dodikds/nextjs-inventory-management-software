"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

const FLASH_MESSAGES: Record<string, string> = {
  created: "Customer created",
  updated: "Customer updated",
};

// createCustomer/updateCustomer call redirect() server-side on success, so
// there's no client-side "result" to react to the way the delete flow has —
// the client only ever sees the navigation. This reads a one-shot ?flash=
// query param after that redirect, fires the toast, then strips the param
// so refreshing the list doesn't replay it.
export default function CustomerFlashToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flash = searchParams.get("flash");

  useEffect(() => {
    if (!flash) return;

    const message = FLASH_MESSAGES[flash];
    if (message) toast.success(message);

    const params = new URLSearchParams(searchParams);
    params.delete("flash");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [flash, pathname, router, searchParams]);

  return null;
}
