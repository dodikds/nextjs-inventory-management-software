"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Pencil, Trash2, X } from "lucide-react";
import { useMasterDataModal, type MasterDataRow } from "./MasterDataModalContext";

export type MasterDataDeleteResult = { success: true } | { success: false; error: string };

type MasterDataRowActionsProps = {
  row: MasterDataRow;
  // e.g. "Brand", "Product Category" — used in the confirmation dialog and
  // the success toast.
  entityLabel: string;
  // Optional so modules that haven't wired delete up yet can still use this
  // component — the delete button renders disabled until one is supplied.
  deleteAction?: (id: string) => Promise<MasterDataDeleteResult>;
};

export default function MasterDataRowActions({ row, entityLabel, deleteAction }: MasterDataRowActionsProps) {
  const router = useRouter();
  const { openEdit } = useMasterDataModal();
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
    if (!deleteAction) return;

    startTransition(async () => {
      const result = await deleteAction(row.id);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`${entityLabel} deleted`);
      setIsConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="gg-row gg-gap-2" style={{ justifyContent: "flex-end" }}>
        <button className="act-btn act-edit" type="button" title="Edit" onClick={() => openEdit(row)}>
          <Pencil />
        </button>
        <button
          className="act-btn act-del"
          type="button"
          title="Delete"
          onClick={() => setIsConfirmOpen(true)}
          disabled={!deleteAction}
        >
          <Trash2 />
        </button>
      </div>

      {deleteAction && (
        <div
          className={`gg-overlay${isConfirmOpen ? " is-open" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsConfirmOpen(false);
          }}
        >
          <div className="gg-modal" role="dialog" aria-modal="true">
            <div className="gg-modal-head">
              <span className="gg-card-title">Delete {entityLabel}</span>
              <button className="gg-modal-close" type="button" onClick={() => setIsConfirmOpen(false)}>
                <X />
              </button>
            </div>
            <div className="gg-modal-body">
              <p className="gg-muted">
                Are you sure you want to delete <strong style={{ color: "var(--ink)" }}>{row.name}</strong>? This
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
      )}
    </>
  );
}
