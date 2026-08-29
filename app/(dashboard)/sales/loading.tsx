import SaleTableSkeleton from "@/components/sales/SaleTableSkeleton";

export default function SalesLoading() {
  return (
    <>
      <div className="gg-table-toolbar">
        <div className="gg-input-icon" style={{ maxWidth: 440, width: "100%" }}>
          <input className="gg-input" placeholder="Search" disabled />
        </div>
        <div className="gg-spacer" />
      </div>
      <div className="gg-card gg-card-pad">
        <SaleTableSkeleton />
      </div>
    </>
  );
}
