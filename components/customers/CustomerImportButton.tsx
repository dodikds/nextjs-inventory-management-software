"use client";

import { Upload } from "lucide-react";
import toast from "react-hot-toast";

export default function CustomerImportButton() {
  return (
    <button
      className="gg-btn gg-btn--secondary"
      type="button"
      onClick={() => toast("Importing customers isn't available yet")}
    >
      <Upload /> Import Customers
    </button>
  );
}
