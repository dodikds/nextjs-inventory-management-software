"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, FileDown, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { deletePurchase } from "@/app/(dashboard)/purchases/actions";
import styles from "./PurchaseRowActions.module.css";

type PurchaseRowActionsProps = {
  id: string;
  reference: string;
};

// Converted from design/Purchases.html's vanilla-JS row-action dropdown
// (the `.action-cell` / `.act-toggle` / click-outside-closes script) into a
// React client component. View, Download PDF, Edit, and Delete are all
// wired to real behavior now.
export default function PurchaseRowActions({ id, reference }: PurchaseRowActionsProps) {
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
      const result = await deletePurchase(id);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Purchase deleted");
      setIsConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className={`${styles["action-cell"]}${isOpen ? " is-open" : ""}`} ref={cellRef}>
        {isOpen && (
          <div className={`gg-menu ${styles.menu}`}>
            <Link href={`/purchases/${id}`} className="gg-menu-item" onClick={closeMenu}>
              <Eye /> View Purchase
            </Link>
            <Link href={`/purchases/${id}?download=1`} className="gg-menu-item" onClick={closeMenu}>
              <FileDown /> Download PDF
            </Link>
            <Link href={`/purchases/${id}/edit`} className="gg-menu-item" onClick={closeMenu}>
              <Pencil /> Edit Purchase
            </Link>
            <button
              type="button"
              className="gg-menu-item is-danger"
              onClick={() => {
                closeMenu();
                setIsConfirmOpen(true);
              }}
            >
              <Trash2 /> Delete Purchase
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
            <span className="gg-card-title">Delete Purchase</span>
            <button className="gg-modal-close" type="button" onClick={() => setIsConfirmOpen(false)}>
              <X />
            </button>
          </div>
          <div className="gg-modal-body">
            <p className="gg-muted">
              Are you sure you want to delete <strong style={{ color: "var(--ink)" }}>{reference}</strong>? If it had
              added stock, that stock will be reversed. This cannot be undone.
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
