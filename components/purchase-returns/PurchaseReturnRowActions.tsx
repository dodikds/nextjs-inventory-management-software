"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, FileDown, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { deletePurchaseReturn } from "@/app/(dashboard)/purchases/returns/actions";
import styles from "./PurchaseReturnRowActions.module.css";

type PurchaseReturnRowActionsProps = {
  id: string;
  reference: string;
};

// Converted from design/Purchases Returns.html's vanilla-JS row-action
// dropdown into a React client component — same pattern as
// PurchaseRowActions.tsx.
export default function PurchaseReturnRowActions({ id, reference }: PurchaseReturnRowActionsProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (cellRef.current && !cellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isConfirmOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsConfirmOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isConfirmOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePurchaseReturn(id);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Purchase return deleted");
      setIsConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className={`${styles["action-cell"]}${isOpen ? " is-open" : ""}`} ref={cellRef}>
        {isOpen && (
          <div className={`gg-menu ${styles.menu}`}>
            <Link href={`/purchases/returns/${id}`} className="gg-menu-item" onClick={closeMenu}>
              <Eye /> View Purchase Return
            </Link>
            <Link href={`/purchases/returns/${id}?download=1`} className="gg-menu-item" onClick={closeMenu}>
              <FileDown /> Download PDF
            </Link>
            <Link href={`/purchases/returns/${id}/edit`} className="gg-menu-item" onClick={closeMenu}>
              <Pencil /> Edit Purchase Return
            </Link>
            <button
              type="button"
              className="gg-menu-item is-danger"
              onClick={() => {
                closeMenu();
                setIsConfirmOpen(true);
              }}
            >
              <Trash2 /> Delete Purchase Return
            </button>
          </div>
        )}
        <button className="gg-row-action" type="button" onClick={() => setIsOpen((open) => !open)}>
          <MoreVertical />
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
            <span className="gg-card-title">Delete Purchase Return</span>
            <button className="gg-modal-close" type="button" onClick={() => setIsConfirmOpen(false)}>
              <X />
            </button>
          </div>
          <div className="gg-modal-body">
            <p className="gg-muted">
              Are you sure you want to delete <strong style={{ color: "var(--ink)" }}>{reference}</strong>? If it had
              removed stock, that stock will be added back. This cannot be undone.
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
