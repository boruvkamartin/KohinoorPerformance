import type { FieldMetricId, MetricId, MetricValues, Rating } from './types'

export type MetricDefinition = {
  id: MetricId | FieldMetricId
  label: string
  shortLabel: string
  unit: 'score' | 'ms' | 'cls'
  description: string
  higherIsBetter: boolean
  good: number
  poor: number
}

export const METRICS: Array<MetricDefinition & { id: MetricId }> = [
  {
    id: 'performance',
    label: 'Performance',
    shortLabel: 'Perf',
    unit: 'score',
    description: 'Celkové Lighthouse skóre výkonu (0–100).',
    higherIsBetter: true,
    good: 90,
    poor: 50,
  },
  {
    id: 'fcp',
    label: 'First Contentful Paint',
    shortLabel: 'FCP',
    unit: 'ms',
    description: 'Kdy se na stránce poprvé objeví text nebo obrázek.',
    higherIsBetter: false,
    good: 1800,
    poor: 3000,
  },
  {
    id: 'lcp',
    label: 'Largest Contentful Paint',
    shortLabel: 'LCP',
    unit: 'ms',
    description: 'Kdy se vykreslí největší prvek ve výřezu.',
    higherIsBetter: false,
    good: 2500,
    poor: 4000,
  },
  {
    id: 'si',
    label: 'Speed Index',
    shortLabel: 'SI',
    unit: 'ms',
    description: 'Jak rychle se vizuálně plní obsah stránky.',
    higherIsBetter: false,
    good: 3400,
    poor: 5800,
  },
  {
    id: 'tbt',
    label: 'Total Blocking Time',
    shortLabel: 'TBT',
    unit: 'ms',
    description: 'Jak dlouho hlavní vlákno blokuje odezvu na vstup.',
    higherIsBetter: false,
    good: 200,
    poor: 600,
  },
  {
    id: 'cls',
    label: 'Cumulative Layout Shift',
    shortLabel: 'CLS',
    unit: 'cls',
    description: 'Jak moc se layout posouvá během načítání.',
    higherIsBetter: false,
    good: 0.1,
    poor: 0.25,
  },
  {
    id: 'ttfb',
    label: 'Time to First Byte',
    shortLabel: 'TTFB',
    unit: 'ms',
    description: 'Čas do první odpovědi serveru.',
    higherIsBetter: false,
    good: 800,
    poor: 1800,
  },
]

export const INP_METRIC: MetricDefinition & { id: 'inp' } = {
  id: 'inp',
  label: 'Interaction to Next Paint',
  shortLabel: 'INP',
  unit: 'ms',
  description: 'Jak rychle stránka zareaguje na klik, tap nebo klávesu.',
  higherIsBetter: false,
  good: 200,
  poor: 500,
}

export const FIELD_METRICS: Array<MetricDefinition & { id: FieldMetricId }> = [
  METRICS.find((metric) => metric.id === 'lcp') as MetricDefinition & { id: 'lcp' },
  INP_METRIC,
  METRICS.find((metric) => metric.id === 'cls') as MetricDefinition & { id: 'cls' },
  METRICS.find((metric) => metric.id === 'fcp') as MetricDefinition & { id: 'fcp' },
  METRICS.find((metric) => metric.id === 'ttfb') as MetricDefinition & { id: 'ttfb' },
]

const METRIC_BY_ID = Object.fromEntries(
  [...METRICS, INP_METRIC].map((metric) => [metric.id, metric]),
) as Record<MetricId | FieldMetricId, MetricDefinition>

export function getMetric(id: MetricId | FieldMetricId): MetricDefinition {
  return METRIC_BY_ID[id]
}

export function rateValue(id: MetricId | FieldMetricId, value: number | null | undefined): Rating {
  if (value == null || !Number.isFinite(value)) return 'unknown'
  const metric = getMetric(id)
  if (metric.higherIsBetter) {
    if (value >= metric.good) return 'good'
    if (value >= metric.poor) return 'needs-improvement'
    return 'poor'
  }
  if (value <= metric.good) return 'good'
  if (value <= metric.poor) return 'needs-improvement'
  return 'poor'
}

export function formatMetricValue(
  id: MetricId | FieldMetricId,
  value: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const metric = getMetric(id)
  if (metric.unit === 'score') {
    return Math.round(value).toLocaleString('cs-CZ')
  }
  if (metric.unit === 'cls') {
    return value.toLocaleString('cs-CZ', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
  }
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('cs-CZ', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} s`
  }
  return `${Math.round(value).toLocaleString('cs-CZ')} ms`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = iso.length <= 10 ? new Date(`${iso}T00:00:00Z`) : new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 100).toLocaleString('cs-CZ')} %`
}

export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'zatím bez měření'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const delta = now - date.getTime()
  if (delta < 60_000) return 'právě teď'
  const minutes = Math.round(delta / 60_000)
  if (minutes < 60) return `před ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `před ${hours} h`
  const days = Math.round(hours / 24)
  return `před ${days} dny`
}

export function emptyMetrics(): MetricValues {
  return {
    performance: null,
    fcp: null,
    lcp: null,
    si: null,
    tbt: null,
    cls: null,
    ttfb: null,
  }
}

export const DAY_MS = 24 * 60 * 60 * 1000
