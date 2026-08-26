"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Pencil, Trash2, X } from "lucide-react";
import { useBrandModal, type BrandRow } from "./BrandModalContext";
import { deleteBrand } from "@/app/(dashboard)/brands/actions";
import styles from "@/app/(dashboard)/brands/brands.module.css";

type BrandRowActionsProps = {
  brand: BrandRow;
};

export default function BrandRowActions({ brand }: BrandRowActionsProps) {
  const router = useRouter();
  const { openEdit } = useBrandModal();
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
      const result = await deleteBrand(brand.id);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Brand deleted");
      setIsConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="gg-row gg-gap-2" style={{ justifyContent: "flex-end" }}>
        <button
          className={`${styles["act-btn"]} act-edit`}
          type="button"
          title="Edit"
          onClick={() => openEdit(brand)}
        >
          <Pencil />
        </button>
        <button
          className={`${styles["act-btn"]} act-del`}
          type="button"
          title="Delete"
          onClick={() => setIsConfirmOpen(true)}
        >
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
            <span className="gg-card-title">Delete Brand</span>
            <button className="gg-modal-close" type="button" onClick={() => setIsConfirmOpen(false)}>
              <X />
            </button>
          </div>
          <div className="gg-modal-body">
            <p className="gg-muted">
              Are you sure you want to delete <strong style={{ color: "var(--ink)" }}>{brand.name}</strong>? This
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
