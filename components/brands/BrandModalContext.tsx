"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type BrandRow = { id: string; name: string; logo: string | null };

type BrandModalState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; brand: BrandRow };

type BrandModalContextValue = {
  state: BrandModalState;
  openCreate: () => void;
  openEdit: (brand: BrandRow) => void;
  close: () => void;
};

const BrandModalContext = createContext<BrandModalContextValue | null>(null);

// Lifts the create/edit modal's open state above both its triggers — the
// toolbar's "Create Brand" button and each row's Edit button — which live in
// different parts of the tree (the toolbar is static, the rows are inside a
// Suspense-wrapped async Server Component). A single modal instance is
// rendered once here rather than duplicated per row, matching the design's
// own single `#overlay` element reused for both Create and Edit.
export function BrandModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BrandModalState>({ mode: "closed" });

  return (
    <BrandModalContext.Provider
      value={{
        state,
        openCreate: () => setState({ mode: "create" }),
        openEdit: (brand) => setState({ mode: "edit", brand }),
        close: () => setState({ mode: "closed" }),
      }}
    >
      {children}
    </BrandModalContext.Provider>
  );
}

export function useBrandModal() {
  const ctx = useContext(BrandModalContext);
  if (!ctx) {
    throw new Error("useBrandModal must be used within a BrandModalProvider");
  }
  return ctx;
}
