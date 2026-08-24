"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteSupplier } from "@/app/(dashboard)/peoples/suppliers/actions";

type SupplierRowActionsProps = {
  id: string;
  name: string;
};

export default function SupplierRowActions({ id, name }: SupplierRowActionsProps) {
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
      const result = await deleteSupplier(id);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Supplier deleted");
      setIsConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="row-acts">
        <Link href={`/peoples/suppliers/${id}/edit`} className="act-edit" title="Edit">
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
            <span className="gg-card-title">Delete Supplier</span>
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
