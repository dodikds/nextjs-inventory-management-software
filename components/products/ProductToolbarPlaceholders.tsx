"use client";

import { Download, Filter, Upload } from "lucide-react";
import toast from "react-hot-toast";

// Filter/Export/Import have no backing implementation yet — wired as
// visible, clickable placeholders (matching design/Products.html's markup)
// rather than silently doing nothing, so it's clear to a user that these
// are coming soon rather than broken.
export function ProductFilterButton() {
  return (
    <button
      className="gg-icon-btn"
      type="button"
      style={{ background: "var(--gold-600)", color: "#fff", borderColor: "var(--gold-600)" }}
      onClick={() => toast("Filtering products isn't available yet")}
    >
      <Filter />
    </button>
  );
}

export function ProductExportButton() {
  return (
    <button
      className="gg-btn gg-btn--secondary"
      type="button"
      onClick={() => toast("Exporting products isn't available yet")}
    >
      <Upload /> Export Products
    </button>
  );
}

export function ProductImportButton() {
  return (
    <button
      className="gg-btn gg-btn--secondary"
      type="button"
      onClick={() => toast("Importing products isn't available yet")}
    >
      <Download /> Import Products
    </button>
  );
}
