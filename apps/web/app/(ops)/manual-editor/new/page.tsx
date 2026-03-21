import Link from 'next/link'
import { CreatePageForm } from './create-page-form'

export default function NewManualPagePage() {
  return (
    <div className="max-w-3xl space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/manual-editor" className="hover:text-foreground hover:underline">
          Manual Editor
        </Link>
        <span>/</span>
        <span className="text-foreground">Create Manual Page</span>
      </div>

      {/* Page heading */}
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
          Create Manual Page
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Add a new page to the client or prison manual.
        </p>
      </div>

      <CreatePageForm />
    </div>
  )
}
