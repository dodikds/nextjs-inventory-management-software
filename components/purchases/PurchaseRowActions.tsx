"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, FileDown, MoreVertical, Pencil, Trash2 } from "lucide-react";
import styles from "./PurchaseRowActions.module.css";

type PurchaseRowActionsProps = {
  id: string;
  reference: string;
};

// Converted from design/Purchases.html's vanilla-JS row-action dropdown
// (the `.action-cell` / `.act-toggle` / click-outside-closes script) into a
// React client component. Delete is still a visible placeholder — Step 8
// (soft-delete with stock reversal) replaces it with real behavior; View,
// Download PDF, and Edit all link to their real routes now.
export default function PurchaseRowActions({ id, reference }: PurchaseRowActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  function closeMenu() {
    setIsOpen(false);
  }

  function handleDelete() {
    closeMenu();
    toast(`Deleting ${reference} isn't available yet`);
  }

  return (
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
          <button type="button" className="gg-menu-item is-danger" onClick={handleDelete}>
            <Trash2 /> Delete Purchase
          </button>
        </div>
      )}
      <button className="gg-row-action" type="button" onClick={() => setIsOpen((open) => !open)}>
        <MoreVertical />
      </button>
    </div>
  );
}
