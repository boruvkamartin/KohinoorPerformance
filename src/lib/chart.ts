import type { CSSProperties } from 'react'
import type { MetricDefinition } from './metrics'
import { formatMetricValue, getMetric } from './metrics'
import type { FieldMetricId, MetricId, PageId, Rating } from './types'

export const SERIES_COLORS: Record<PageId, string> = {
  homepage: '#163844',
  category: '#b36a12',
  product: '#76517c',
  basket: '#39758a',
}

export const RATING_LABEL: Record<Rating, string> = {
  good: 'good',
  'needs-improvement': 'needs improvement',
  poor: 'poor',
  unknown: 'bez hodnocení',
}

export const chartAxisTick = {
  fill: 'var(--muted)',
  fontSize: 11,
  fontFamily: 'var(--mono)',
} as const

export const chartCursor = {
  stroke: 'var(--pencil)',
  strokeDasharray: '3 3',
  strokeWidth: 1.5,
} as const

export const tooltipWrapperStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  boxShadow: 'none',
  zIndex: 4,
}

export function metricYDomain(metric: MetricDefinition, values: number[]): [number, number] {
  if (metric.higherIsBetter) return [0, 100]
  const peak = Math.max(metric.poor * 1.25, ...values)
  return [0, niceCeiling(peak > 0 ? peak : metric.poor * 1.25)]
}

function niceCeiling(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return Number((nice * magnitude).toPrecision(12))
}

export function formatValueDelta(
  id: MetricId | FieldMetricId,
  current: number,
  previous: number | undefined,
): string | null {
  if (previous == null || !Number.isFinite(previous)) return null
  const metric = getMetric(id)
  const delta = current - previous
  const epsilon = metric.unit === 'cls' ? 0.0005 : metric.unit === 'score' ? 0.5 : 1
  if (Math.abs(delta) < epsilon) return 'stejné jako předchozí měření'
  const better = metric.higherIsBetter ? delta > 0 : delta < 0
  const formatted = formatMetricValue(id, Math.abs(delta))
  return `${better ? 'Lepší' : 'Horší'} ${delta > 0 ? '+' : '−'}${formatted} proti předchozímu`
}

export function previousInSeries(values: Array<number | null | undefined>, index: number) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const value = values[i]
    if (value != null && Number.isFinite(value)) return value
  }
  return undefined
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
