import TransferTableSkeleton from "@/components/transfers/TransferTableSkeleton";

export default function TransfersLoading() {
  return (
    <>
      <div className="gg-table-toolbar">
        <div className="gg-input-icon" style={{ maxWidth: 440, width: "100%" }}>
          <input className="gg-input" placeholder="Search" disabled />
        </div>
        <div className="gg-spacer" />
      </div>
      <div className="gg-card gg-card-pad">
        <TransferTableSkeleton />
      </div>
    </>
  );
}
