"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, Pencil, Trash2, X } from "lucide-react";
import { deleteProduct } from "@/app/(dashboard)/products/actions";

type ProductRowActionsProps = {
  id: string;
  name: string;
  // Viewing a product isn't permission-gated (its detail page has no
  // hasPermission() check), so View always renders — only Edit/Delete are
  // hidden without manage_products.
  canManage: boolean;
};

export default function ProductRowActions({ id, name, canManage }: ProductRowActionsProps) {
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
      const result = await deleteProduct(id);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Product deleted");
      setIsConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="gg-row gg-gap-2" style={{ justifyContent: "flex-end" }}>
        <Link href={`/products/${id}`} className="act-btn act-view" title="View">
          <Eye />
        </Link>
        {canManage && (
          <>
            <Link href={`/products/${id}/edit`} className="act-btn act-edit" title="Edit">
              <Pencil />
            </Link>
            <button className="act-btn act-del" type="button" title="Delete" onClick={() => setIsConfirmOpen(true)}>
              <Trash2 />
            </button>
          </>
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
            <span className="gg-card-title">Delete Product</span>
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
