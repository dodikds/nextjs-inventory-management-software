import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProductById } from "@/app/(dashboard)/products/queries";

type ProductStockReportPageProps = {
  params: Promise<{ productId: string }>;
};

// Stub for the per-product stock history report design/Stock Reports.html's
// "Reports" row button points at — deferred out of this task's scope. The
// route is real (not a dead "#" link) so the button already goes somewhere
// meaningful; the actual movement history table is future work.
export default async function ProductStockReportPage({ params }: ProductStockReportPageProps) {
  const { productId } = await params;
  const product = await getProductById(productId);
  if (!product) {
    notFound();
  }

  return (
    <div>
      <Link href="/reports/stock" className="gg-btn gg-btn--ghost" style={{ marginBottom: "var(--sp-6)" }}>
        <ArrowLeft /> Back to Stock Reports
      </Link>
      <div className="gg-card gg-card-pad">
        <p className="gg-td-strong">{product.name}</p>
        <p className="gg-muted">Per-product stock history isn&apos;t available yet.</p>
      </div>
    </div>
  );
}
