"use client";

import { Plus } from "lucide-react";
import { useMasterDataModal } from "./MasterDataModalContext";

type MasterDataCreateButtonProps = {
  entityLabel: string;
};

export default function MasterDataCreateButton({ entityLabel }: MasterDataCreateButtonProps) {
  const { openCreate } = useMasterDataModal();
  return (
    <button className="gg-btn gg-btn--primary" type="button" onClick={openCreate}>
      <Plus /> Create {entityLabel}
    </button>
  );
}
