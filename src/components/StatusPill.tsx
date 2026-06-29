import type { BathingStatus } from '../data/types'
import { statusMeta } from '../lib/format'

type StatusPillProps = {
  status: BathingStatus
  label?: string
}

export function StatusPill({ status, label }: StatusPillProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusMeta[status].className}`}>
      {label ?? statusMeta[status].label}
    </span>
  )
}
