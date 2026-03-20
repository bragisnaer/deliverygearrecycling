import Link from 'next/link'
import { ProductForm } from '../components/product-form'

export default function NewProductPage() {
  return (
    <div className="max-w-3xl space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/products" className="hover:text-foreground hover:underline">
          Products
        </Link>
        <span>/</span>
        <span className="text-foreground">New Product</span>
      </div>

      {/* Page heading */}
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">New Product</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Add a new product to the registry.
        </p>
      </div>

      {/* Create form — no product prop = create mode */}
      <ProductForm />
    </div>
  )
}
