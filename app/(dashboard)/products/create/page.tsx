import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import ProductForm from "@/components/products/ProductForm";
import { createProduct } from "../actions";
import {
  getCategoryOptions,
  getBrandOptions,
  getUnitOptions,
  getWarehouseOptions,
  getSupplierOptions,
} from "../queries";

export default async function CreateProductPage() {
  const session = await auth();
  if (!hasPermission(session, "manage_products")) {
    redirect("/products");
  }

  const [categories, brands, units, warehouses, suppliers] = await Promise.all([
    getCategoryOptions(),
    getBrandOptions(),
    getUnitOptions(),
    getWarehouseOptions(),
    getSupplierOptions(),
  ]);

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Product</h1>
        <Link href="/products" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <ProductForm
        categories={categories}
        brands={brands}
        units={units}
        warehouses={warehouses}
        suppliers={suppliers}
        action={createProduct}
      />
    </>
  );
}
