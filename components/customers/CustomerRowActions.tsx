"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteCustomer } from "@/app/(dashboard)/customers/actions";

type CustomerRowActionsProps = {
  id: string;
  name: string;
  isDefault: boolean;
};

export default function CustomerRowActions({ id, name, isDefault }: CustomerRowActionsProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isConfirmOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsConfirmOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isConfirmOpen]);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCustomer(id);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Customer deleted");
      setIsConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="row-acts">
        <Link href={`/customers/${id}/edit`} className="act-edit" title="Edit">
          <Pencil />
        </Link>
        {/* The direct-customer default is the POS's walk-in fallback and must
            always exist, so its delete control is hidden rather than shown
            disabled — there's no valid state in which clicking it should do
            anything. The server action enforces the same rule independently,
            since this is only a UI convenience, not the real guard. */}
        {!isDefault && (
          <button className="act-del" title="Delete" type="button" onClick={() => setIsConfirmOpen(true)}>
            <Trash2 />
          </button>
        )}
      </div>

      <div
        className={`gg-overlay${isConfirmOpen ? " is-open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsConfirmOpen(false);
        }}
      >
        <div className="gg-modal" role="dialog" aria-modal="true">
          <div className="gg-modal-head">
            <span className="gg-card-title">Delete Customer</span>
            <button className="gg-modal-close" type="button" onClick={() => setIsConfirmOpen(false)}>
              <X />
            </button>
          </div>
          <div className="gg-modal-body">
            <p className="gg-muted">
              Are you sure you want to delete <strong style={{ color: "var(--ink)" }}>{name}</strong>? This cannot be
              undone.
            </p>
          </div>
          <div className="gg-modal-foot">
            <button className="gg-btn gg-btn--danger" type="button" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </button>
            <button
              className="gg-btn gg-btn--secondary"
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
