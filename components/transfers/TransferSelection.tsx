"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import styles from "@/app/(dashboard)/transfers/transfers.module.css";

// design/Transfers.html's select-all checkbox column has no bulk action
// wired to it in the mockup (its own script just checks/unchecks every
// `.row-check` when the header one changes) — this ports that same
// behavior into React via a small shared Context, since the header
// checkbox (in <thead>) and the row checkboxes (one per <tbody> row,
// rendered by the server component) need to read/write the same selection
// state without either one owning the other. Selection is intentionally
// page-scoped, in-memory only — it resets on navigation/revalidation, same
// as the mockup's own (never persisted anywhere).
type SelectionContextValue = {
  selected: Set<string>;
  toggle: (id: string) => void;
  selectAll: (ids: string[], checked: boolean) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function TransferSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[], checked: boolean) => {
    setSelected(checked ? new Set(ids) : new Set());
  }, []);

  const value = useMemo(() => ({ selected, toggle, selectAll }), [selected, toggle, selectAll]);

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error("Transfer checkboxes must be rendered inside a TransferSelectionProvider");
  }
  return ctx;
}

type SelectAllCheckboxProps = {
  ids: string[];
};

export function TransferSelectAllCheckbox({ ids }: SelectAllCheckboxProps) {
  const { selected, selectAll } = useSelection();
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  return (
    <input
      type="checkbox"
      className={styles["gg-check"]}
      checked={allSelected}
      onChange={(e) => selectAll(ids, e.target.checked)}
      aria-label="Select all transfers on this page"
    />
  );
}

type TransferRowCheckboxProps = {
  id: string;
};

export function TransferRowCheckbox({ id }: TransferRowCheckboxProps) {
  const { selected, toggle } = useSelection();

  return (
    <input
      type="checkbox"
      className={styles["gg-check"]}
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label="Select transfer"
    />
  );
}
