import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProduct, getCurrentComposition, getMaterials, getPricingHistory } from '../actions'
import { ProductForm } from '../components/product-form'
import { ProductPhotoUpload } from '../components/product-photo-upload'
import { MaterialCompositionTable } from '../components/material-composition-table'
import { PricingManagement } from '../components/pricing-management'

interface ProductDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params
  const [product, compositionResult, materialsResult, pricingResult] = await Promise.all([
    getProduct(id),
    getCurrentComposition(id),
    getMaterials(),
    getPricingHistory(id),
  ])

  if (!product) {
    notFound()
  }

  return (
    <div className="max-w-3xl space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/products" className="hover:text-foreground hover:underline">
          Products
        </Link>
        <span>/</span>
        <span className="text-foreground">{product.name}</span>
      </div>

      {/* Page heading */}
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">{product.name}</h1>
        <p className="mt-1 font-mono text-[13px] text-muted-foreground">{product.product_code}</p>
      </div>

      {/* Section 1: Product details */}
      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold">Product Details</h2>
        <ProductForm
          product={{
            id: product.id,
            name: product.name,
            product_code: product.product_code,
            product_group: product.product_group,
            processing_stream: product.processing_stream,
            description: product.description,
            weight_grams: product.weight_grams,
            active: product.active,
          }}
        />
      </section>

      {/* Divider */}
      <hr className="border-border" />

      {/* Section 2: Product photos */}
      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold">Product Photos</h2>
        <p className="text-[14px] text-muted-foreground">
          Upload up to 5 identification photos for this product.
        </p>
        <ProductPhotoUpload
          productId={product.id}
          existingPhotos={product.photos}
        />
      </section>

      {/* Divider */}
      <hr className="border-border" />

      {/* Section 3: Material Composition */}
      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold">Material Composition</h2>
        <p className="text-[14px] text-muted-foreground">
          Define the material breakdown for this product. Saving creates a new effective-dated record.
        </p>
        <MaterialCompositionTable
          productId={product.id}
          initialComposition={compositionResult.composition}
          materials={materialsResult.materials}
        />
      </section>

      {/* Divider */}
      <hr className="border-border" />

      {/* Section 4: Pricing */}
      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold">Pricing</h2>
        <p className="text-[14px] text-muted-foreground">
          Effective-dated pricing records. Adding a new price automatically closes the previous record.
        </p>
        <PricingManagement
          productId={product.id}
          initialPricing={pricingResult.pricing}
        />
      </section>
    </div>
  )
}
