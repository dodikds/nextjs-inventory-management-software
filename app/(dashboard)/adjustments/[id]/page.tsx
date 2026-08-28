import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDateTimeChip } from "@/lib/format";
import { getAdjustmentById } from "../queries";

type AdjustmentViewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdjustmentViewPage({ params }: AdjustmentViewPageProps) {
  const { id } = await params;
  const adjustment = await getAdjustmentById(id);
  if (!adjustment) {
    notFound();
  }

  const date = formatDateTimeChip(adjustment.date);
  const created = formatDateTimeChip(adjustment.createdAt);

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Adjustment Details</h1>
        <Link href="/adjustments" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <div className="gg-card gg-card-pad">
        <div className="pd-title">Adjustment Details : {adjustment.reference}</div>

        <div className="info-grid">
          <div className="info-panel">
            <div className="band">Adjustment Info</div>
            <div className="info-body">
              <div className="info-line">
                <span className="k">Reference :</span>
                <span className="v gg-num">{adjustment.reference}</span>
              </div>
              <div className="info-line">
                <span className="k">Warehouse :</span>
                <span className="v">{adjustment.warehouse.name}</span>
              </div>
              <div className="info-line">
                <span className="k">Date :</span>
                <span className="v gg-num">{date.date}</span>
              </div>
            </div>
          </div>

          <div className="info-panel">
            <div className="band">Meta</div>
            <div className="info-body">
              <div className="info-line">
                <span className="k">Items :</span>
                <span className="v gg-num">{adjustment.items.length}</span>
              </div>
              <div className="info-line">
                <span className="k">Created On :</span>
                <span className="v gg-num">
                  {created.date} {created.time}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="band" style={{ borderRadius: "var(--r-md)", marginBottom: "var(--sp-5)" }}>
          Adjustment Items
        </div>
        <div className="gg-table-wrap">
          <table className="gg-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Code</th>
                <th>Type</th>
                <th style={{ textAlign: "right" }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {adjustment.items.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="gg-muted" style={{ padding: "var(--sp-6) 0", textAlign: "center" }}>
                      No items on this adjustment.
                    </div>
                  </td>
                </tr>
              ) : (
                adjustment.items.map((item) => (
                  <tr key={item.id}>
                    <td className="gg-td-strong">{item.product.name}</td>
                    <td>
                      <span className="gg-chip-code">{item.product.code}</span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          color: item.type === "ADDITION" ? "var(--success-fg)" : "var(--danger)",
                        }}
                      >
                        {item.type === "ADDITION" ? "Addition" : "Subtraction"}
                      </span>
                    </td>
                    <td className="gg-num" style={{ textAlign: "right" }}>
                      {item.type === "ADDITION" ? "+" : "-"}
                      {item.quantity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
