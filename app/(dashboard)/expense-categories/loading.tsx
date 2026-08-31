import ExpenseCategoryTableSkeleton from "@/components/expense-categories/ExpenseCategoryTableSkeleton";

export default function ExpenseCategoriesLoading() {
  return (
    <>
      <div className="gg-table-toolbar">
        <div className="gg-input-icon" style={{ maxWidth: 460, width: "100%" }}>
          <input className="gg-input" placeholder="Search" disabled />
        </div>
        <div className="gg-spacer" />
      </div>
      <div className="gg-card gg-card-pad">
        <ExpenseCategoryTableSkeleton />
      </div>
    </>
  );
}
