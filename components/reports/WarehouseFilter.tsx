"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type WarehouseFilterProps = {
  warehouses: { id: string; name: string }[];
};

// Persists the selected warehouse in the URL (like every other filter in
// this app) so the report stays a real, linkable, server-rendered page —
// not client-side state. Changing it resets pagination since a different
// warehouse means a different result set.
export default function WarehouseFilter({ warehouses }: WarehouseFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get("warehouseId") ?? "";

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set("warehouseId", next);
    } else {
      params.delete("warehouseId");
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="wh-filter">
      <label>Warehouse :</label>
      <select className="gg-select" value={value} onChange={(e) => handleChange(e.target.value)}>
        <option value="">All Warehouse</option>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name}
          </option>
        ))}
      </select>
    </div>
  );
}
