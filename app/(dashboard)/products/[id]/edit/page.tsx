import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import ProductForm from "@/components/products/ProductForm";
import { getProductById, getCategoryOptions, getBrandOptions, getUnitOptions } from "../../queries";
import { updateProduct } from "../../actions";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_products")) {
    redirect("/products");
  }

  const { id } = await params;
  const [product, categories, brands, units] = await Promise.all([
    getProductById(id),
    getCategoryOptions(),
    getBrandOptions(),
    getUnitOptions(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Product</h1>
        <Link href="/products" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <ProductForm
        initial={{
          name: product.name,
          code: product.code,
          categoryId: product.categoryId,
          brandId: product.brandId,
          price: product.price.toString(),
          productUnit: product.productUnit,
          stockAlert: product.stockAlert?.toString() ?? "",
          orderTax: product.orderTax?.toString() ?? "",
          taxType: product.taxType,
          quantityLimitation: product.quantityLimitation?.toString() ?? "",
          notes: product.notes ?? "",
        }}
        existingImages={product.images.map((image) => ({ id: image.id, path: image.path }))}
        categories={categories}
        brands={brands}
        units={units}
        action={updateProduct.bind(null, id)}
      />
    </>
  );
}
