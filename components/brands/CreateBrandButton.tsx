"use client";

import { Plus } from "lucide-react";
import { useBrandModal } from "./BrandModalContext";

export default function CreateBrandButton() {
  const { openCreate } = useBrandModal();
  return (
    <button className="gg-btn gg-btn--primary" type="button" onClick={openCreate}>
      <Plus /> Create Brand
    </button>
  );
}
