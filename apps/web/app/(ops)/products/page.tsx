import Link from 'next/link'
import { getProducts } from './actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function ProductsPage() {
  const productList = await getProducts()

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">Products</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Manage product registry for your tenant.
          </p>
        </div>
        <Button render={<Link href="/products/new" />}>Add Product</Button>
      </div>

      {productList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[14px] text-muted-foreground">No products found.</p>
          <Button className="mt-4" render={<Link href="/products/new" />}>
            Add your first product
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Stream</TableHead>
              <TableHead>Weight (g)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productList.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <Link
                    href={`/products/${product.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {product.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">
                  {product.product_code}
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {product.product_group ?? '—'}
                </TableCell>
                <TableCell className="text-[13px]">
                  <span className="capitalize">{product.processing_stream}</span>
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {product.weight_grams ?? '—'}
                </TableCell>
                <TableCell>
                  {product.active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/products/${product.id}`}
                    className="font-mono text-[13px] text-primary hover:underline"
                  >
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
