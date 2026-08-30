"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, Pencil, Trash2, X } from "lucide-react";
import { deleteTransfer } from "@/app/(dashboard)/transfers/actions";

type TransferRowActionsProps = {
  id: string;
  reference: string;
};

// design/Transfers.html renders View/Edit/Delete as always-visible inline
// icon buttons (`.row-acts`), not a dropdown menu — same pattern as
// Warehouse/Suppliers/Customers' own row actions, unlike Purchases/Sale
// Returns' "..." menu.
export default function TransferRowActions({ id, reference }: TransferRowActionsProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!isConfirmOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsConfirmOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isConfirmOpen]);

  async function handleDelete() {
    setIsPending(true);
    try {
      const result = await deleteTransfer(id);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Transfer deleted");
      setIsConfirmOpen(false);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <div className="row-acts">
        <Link href={`/transfers/${id}`} className="act-view" title="View">
          <Eye />
        </Link>
        <Link href={`/transfers/${id}/edit`} className="act-edit" title="Edit">
          <Pencil />
        </Link>
        <button className="act-del" title="Delete" type="button" onClick={() => setIsConfirmOpen(true)}>
          <Trash2 />
        </button>
      </div>

      <div
        className={`gg-overlay${isConfirmOpen ? " is-open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsConfirmOpen(false);
        }}
      >
        <div className="gg-modal" role="dialog" aria-modal="true">
          <div className="gg-modal-head">
            <span className="gg-card-title">Delete Transfer</span>
            <button className="gg-modal-close" type="button" onClick={() => setIsConfirmOpen(false)}>
              <X />
            </button>
          </div>
          <div className="gg-modal-body">
            <p className="gg-muted">
              Are you sure you want to delete <strong style={{ color: "var(--ink)" }}>{reference}</strong>? This
              cannot be undone.
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
