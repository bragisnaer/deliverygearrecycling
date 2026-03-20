'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { uploadProductPhoto, deleteProductPhoto } from '../actions'

// --- Types ---

interface Photo {
  path: string
  url: string
}

interface ProductPhotoUploadProps {
  productId: string
  existingPhotos: Photo[]
  maxPhotos?: number
}

// --- Component ---

export function ProductPhotoUpload({
  productId,
  existingPhotos,
  maxPhotos = 5,
}: ProductPhotoUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [enlargedPhoto, setEnlargedPhoto] = useState<Photo | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const photoCount = existingPhotos.length
  const canAddMore = photoCount < maxPhotos

  async function uploadFiles(files: File[]) {
    const remaining = maxPhotos - photoCount
    const filesToUpload = files.slice(0, remaining)

    if (files.length > remaining) {
      toast.warning(`Only ${remaining} more photo(s) can be added (max ${maxPhotos})`)
    }

    for (const file of filesToUpload) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: File must be 5MB or less`)
        continue
      }
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}: Only image files are allowed`)
        continue
      }

      const formData = new FormData()
      formData.set('file', file)

      startTransition(async () => {
        const result = await uploadProductPhoto(productId, formData)
        if ('error' in result) {
          toast.error(result.error)
        } else {
          toast.success('Photo uploaded')
        }
      })
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (!canAddMore) {
      toast.error(`Maximum ${maxPhotos} photos reached`)
      return
    }
    const files = Array.from(e.dataTransfer.files)
    void uploadFiles(files)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canAddMore) {
      toast.error(`Maximum ${maxPhotos} photos reached`)
      return
    }
    const files = Array.from(e.target.files ?? [])
    void uploadFiles(files)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function handleDelete(photo: Photo) {
    if (!confirm('Remove this photo?')) return
    startTransition(async () => {
      const result = await deleteProductPhoto(productId, photo.path)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Photo removed')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Count indicator */}
      <p className="text-[13px] text-muted-foreground">
        {photoCount}/{maxPhotos} photos
      </p>

      {/* Thumbnail grid */}
      {existingPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {existingPhotos.map((photo) => (
            <div key={photo.path} className="group relative">
              <Dialog>
                <DialogTrigger
                  className="block w-full overflow-hidden rounded-lg border border-border"
                  onClick={() => setEnlargedPhoto(photo)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt="Product photo"
                    className="aspect-square w-full object-cover"
                  />
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogTitle className="sr-only">Product photo</DialogTitle>
                  {enlargedPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={enlargedPhoto.url}
                      alt="Product photo enlarged"
                      className="w-full rounded-lg object-contain"
                    />
                  )}
                </DialogContent>
              </Dialog>

              {/* Delete button overlay */}
              <button
                type="button"
                onClick={() => handleDelete(photo)}
                disabled={isPending}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80 disabled:pointer-events-none"
                aria-label="Remove photo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone — only shown if more photos can be added */}
      {canAddMore && (
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 text-center transition-colors',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/30',
            isPending ? 'pointer-events-none opacity-60' : '',
          ].join(' ')}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-2 h-8 w-8 text-muted-foreground"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <p className="text-[14px] font-medium text-foreground">
            {isPending ? 'Uploading...' : 'Drop photos here or click to browse'}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Images only · Max 5MB each · Up to {maxPhotos} total
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  )
}
