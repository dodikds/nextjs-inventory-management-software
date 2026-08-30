"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { DiscountType, TaxType } from "@/lib/pricing";

export type TransferItemModalValues = {
  unitCost: string;
  taxType: TaxType;
  orderTax: string;
  discountType: DiscountType;
  discount: string;
  unit: string;
};

type TransferItemModalProps = {
  productName: string;
  units: { id: string; name: string }[];
  initialValues: TransferItemModalValues;
  onSave: (values: TransferItemModalValues) => void;
  onClose: () => void;
};

// design/Create Transfer.html's item-edit modal, opened by each Order
// items row's pencil icon — same field set as Purchase's own modal (Product
// Cost/Tax Type/Order Tax/Discount Type/Discount/Product Unit). Edits are
// held in local draft state — nothing touches the row until Save, so
// Cancel/Escape/overlay-click can discard changes for free.
export default function TransferItemModal({
  productName,
  units,
  initialValues,
  onSave,
  onClose,
}: TransferItemModalProps) {
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSave() {
    onSave(values);
  }

  const discountSuffix = values.discountType === "PERCENTAGE" ? "%" : "$";

  return (
    <div
      className="gg-overlay is-open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gg-modal" role="dialog" aria-modal="true">
        <div className="gg-modal-head">
          <span className="gg-card-title">{productName}</span>
          <button className="gg-modal-close" type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="gg-modal-body">
          <div className="gg-field">
            <label className="gg-label" htmlFor="itemCost">
              Product Cost <span className="gg-req">*</span>
            </label>
            <div className="gg-input-group">
              <input
                id="itemCost"
                className="gg-input gg-num"
                value={values.unitCost}
                onChange={(e) => setValues((prev) => ({ ...prev, unitCost: e.target.value }))}
              />
              <span className="gg-input-suffix">$</span>
            </div>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="itemTaxType">
              Tax Type <span className="gg-req">*</span>
            </label>
            <select
              id="itemTaxType"
              className="gg-select"
              value={values.taxType}
              onChange={(e) => setValues((prev) => ({ ...prev, taxType: e.target.value as TaxType }))}
            >
              <option value="INCLUSIVE">Inclusive</option>
              <option value="EXCLUSIVE">Exclusive</option>
            </select>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="itemOrderTax">
              Order Tax
            </label>
            <div className="gg-input-group">
              <input
                id="itemOrderTax"
                className="gg-input gg-num"
                value={values.orderTax}
                onChange={(e) => setValues((prev) => ({ ...prev, orderTax: e.target.value }))}
              />
              <span className="gg-input-suffix">%</span>
            </div>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="itemDiscountType">
              Discount Type <span className="gg-req">*</span>
            </label>
            <select
              id="itemDiscountType"
              className="gg-select"
              value={values.discountType}
              onChange={(e) => setValues((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
            >
              <option value="FIXED">Fixed</option>
              <option value="PERCENTAGE">Percentage</option>
            </select>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="itemDiscount">
              Discount <span className="gg-req">*</span>
            </label>
            <div className="gg-input-group">
              <input
                id="itemDiscount"
                className="gg-input gg-num"
                value={values.discount}
                onChange={(e) => setValues((prev) => ({ ...prev, discount: e.target.value }))}
              />
              <span className="gg-input-suffix">{discountSuffix}</span>
            </div>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="itemUnit">
              Product Unit <span className="gg-req">*</span>
            </label>
            <select
              id="itemUnit"
              className="gg-select"
              value={values.unit}
              onChange={(e) => setValues((prev) => ({ ...prev, unit: e.target.value }))}
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.name}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="gg-modal-foot">
          <button className="gg-btn gg-btn--primary" type="button" onClick={handleSave}>
            <Check /> Save
          </button>
          <button className="gg-btn gg-btn--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
