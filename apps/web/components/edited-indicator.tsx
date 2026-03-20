'use client'

import { Badge } from '@/components/ui/badge'
import { isRecordEdited } from '@/lib/audit-helpers'
import { Pencil } from 'lucide-react'

// Re-export so consumers can derive isEdited from audit entries alongside the component
export { isRecordEdited }

interface EditedIndicatorProps {
  isEdited: boolean
  onViewHistory?: () => void
  label?: string
}

/**
 * Renders a small "Redigeret" badge with a pencil icon when a record has been edited.
 * Clicking the badge opens the edit history modal via the onViewHistory callback.
 * Returns null when isEdited is false — renders nothing.
 */
export function EditedIndicator({
  isEdited,
  onViewHistory,
  label = 'Redigeret',
}: EditedIndicatorProps) {
  if (!isEdited) return null

  return (
    <Badge
      variant="outline"
      className="cursor-pointer gap-1 text-xs"
      onClick={onViewHistory}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onViewHistory?.()
        }
      }}
    >
      <Pencil className="h-3 w-3" />
      {label}
    </Badge>
  )
}
