"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type MasterDataRow = { id: string; name: string; logo: string | null };

// Shared result shape every master-data module's create/update server
// actions return, and what MasterDataModal is typed against — so any new
// module (Units, ...) just needs to match this contract to plug into the
// generic modal without further changes there.
export type MasterDataFieldErrors = Partial<Record<"name", string>>;

export type MasterDataActionResult =
  | { success: true; row: MasterDataRow }
  | { success: false; errors?: MasterDataFieldErrors; message?: string };

type MasterDataModalState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; row: MasterDataRow };

type MasterDataModalContextValue = {
  state: MasterDataModalState;
  openCreate: () => void;
  openEdit: (row: MasterDataRow) => void;
  close: () => void;
};

const MasterDataModalContext = createContext<MasterDataModalContextValue | null>(null);

// Lifts the create/edit modal's open state above both its triggers — the
// toolbar's Create button and each row's Edit button — which live in
// different parts of the tree (the toolbar is static, the rows are inside a
// Suspense-wrapped async Server Component). A single modal instance is
// rendered once per page rather than duplicated per row, matching the
// design's own single `#overlay` element reused for both Create and Edit.
//
// Shared by every "name + logo" master-data module (Brands, Product
// Categories, Units, ...) — each page mounts its own
// `<MasterDataModalProvider>` instance, so state never leaks between pages
// even though they all use the same Context.
export function MasterDataModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MasterDataModalState>({ mode: "closed" });

  return (
    <MasterDataModalContext.Provider
      value={{
        state,
        openCreate: () => setState({ mode: "create" }),
        openEdit: (row) => setState({ mode: "edit", row }),
        close: () => setState({ mode: "closed" }),
      }}
    >
      {children}
    </MasterDataModalContext.Provider>
  );
}

export function useMasterDataModal() {
  const ctx = useContext(MasterDataModalContext);
  if (!ctx) {
    throw new Error("useMasterDataModal must be used within a MasterDataModalProvider");
  }
  return ctx;
}
