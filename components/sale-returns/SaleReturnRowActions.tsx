"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, FileDown, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { deleteSaleReturn } from "@/app/(dashboard)/sales/returns/actions";
import styles from "./SaleReturnRowActions.module.css";

type SaleReturnRowActionsProps = {
  id: string;
  reference: string;
};

// Converted from design/Sales Returns.html's vanilla-JS row-action dropdown
// into a React client component — same pattern as every other module's row
// actions.
export default function SaleReturnRowActions({ id, reference }: SaleReturnRowActionsProps) {
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
      const result = await deleteSaleReturn(id);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Sale return deleted");
      setIsConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className={`${styles["action-cell"]}${isOpen ? " is-open" : ""}`} ref={cellRef}>
        {isOpen && (
          <div className={`gg-menu ${styles.menu}`}>
            <Link href={`/sales/returns/${id}`} className="gg-menu-item" onClick={closeMenu}>
              <Eye /> View Sale Return
            </Link>
            <Link href={`/sales/returns/${id}?download=1`} className="gg-menu-item" onClick={closeMenu}>
              <FileDown /> Download PDF
            </Link>
            <Link href={`/sales/returns/${id}/edit`} className="gg-menu-item" onClick={closeMenu}>
              <Pencil /> Edit Sale Return
            </Link>
            <button
              type="button"
              className="gg-menu-item is-danger"
              onClick={() => {
                closeMenu();
                setIsConfirmOpen(true);
              }}
            >
              <Trash2 /> Delete Sale Return
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
            <span className="gg-card-title">Delete Sale Return</span>
            <button className="gg-modal-close" type="button" onClick={() => setIsConfirmOpen(false)}>
              <X />
            </button>
          </div>
          <div className="gg-modal-body">
            <p className="gg-muted">
              Are you sure you want to delete <strong style={{ color: "var(--ink)" }}>{reference}</strong>? The stock
              it added back will be removed again. This cannot be undone.
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
