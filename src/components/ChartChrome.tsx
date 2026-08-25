import type { ReactNode } from 'react'
import { ReferenceArea, ReferenceLine } from 'recharts'
import type { MetricDefinition } from '../lib/metrics'
import { rateValue } from '../lib/metrics'
import { RATING_LABEL } from '../lib/chart'
import type { FieldMetricId, MetricId, Rating } from '../lib/types'

type ChartShellProps = {
  title: string
  description: string
  empty?: string | null
  height?: 'lab' | 'field'
  legend?: ReactNode
  children: ReactNode
}

export function ChartShell({ title, description, empty, height = 'lab', legend, children }: ChartShellProps) {
  return (
    <figure className="chart">
      <figcaption>
        <strong>{title}</strong>
        <span>{description}</span>
      </figcaption>
      {empty ? (
        <div className="chart-empty">{empty}</div>
      ) : (
        <>
          {legend}
          <div className={`chart-frame is-${height}`}>{children}</div>
          <ChartBandKey />
        </>
      )}
    </figure>
  )
}

export function ThresholdBands({ metric, yMax }: { metric: MetricDefinition; yMax: number }) {
  const bands = metric.higherIsBetter
    ? [
        { key: 'good', y1: metric.good, y2: yMax, fill: 'color-mix(in srgb, var(--good) 14%, transparent)' },
        { key: 'ok', y1: metric.poor, y2: metric.good, fill: 'color-mix(in srgb, var(--needs-improvement) 12%, transparent)' },
        { key: 'poor', y1: 0, y2: metric.poor, fill: 'color-mix(in srgb, var(--poor) 14%, transparent)' },
      ]
    : [
        { key: 'good', y1: 0, y2: metric.good, fill: 'color-mix(in srgb, var(--good) 14%, transparent)' },
        { key: 'ok', y1: metric.good, y2: metric.poor, fill: 'color-mix(in srgb, var(--needs-improvement) 12%, transparent)' },
        { key: 'poor', y1: metric.poor, y2: yMax, fill: 'color-mix(in srgb, var(--poor) 14%, transparent)' },
      ]

  return (
    <>
      {bands.map((band) => (
        <ReferenceArea
          key={band.key}
          y1={band.y1}
          y2={band.y2}
          fill={band.fill}
          fillOpacity={1}
          strokeOpacity={0}
          ifOverflow="visible"
        />
      ))}
      <ReferenceLine y={metric.good} stroke="var(--good)" strokeDasharray="5 4" strokeOpacity={0.45} />
      <ReferenceLine y={metric.poor} stroke="var(--poor)" strokeDasharray="5 4" strokeOpacity={0.4} />
    </>
  )
}

export function RatingDot({
  cx,
  cy,
  value,
  payload,
  dataKey,
  metricId,
  r = 3.5,
}: {
  cx?: number
  cy?: number
  value?: unknown
  payload?: Record<string, unknown>
  dataKey?: unknown
  metricId: MetricId | FieldMetricId
  r?: number
}) {
  const fromPayload =
    payload == null
      ? undefined
      : typeof dataKey === 'string' || typeof dataKey === 'number'
        ? payload[dataKey]
        : payload.value
  const numeric = [value, fromPayload].find((item) => typeof item === 'number' && Number.isFinite(item))
  if (cx == null || cy == null || typeof numeric !== 'number') return null
  const rating = rateValue(metricId, numeric)
  return <circle cx={cx} cy={cy} r={r} className={`chart-dot rating-${rating}`} />
}

export function ChartTooltipCard({
  kicker,
  value,
  rating,
  meta,
  delta,
}: {
  kicker: string
  value: string
  rating: Rating
  meta?: string
  delta?: string | null
}) {
  return (
    <div className={`chart-tip rating-${rating}`}>
      <p className="chart-tip-kicker">{kicker}</p>
      <p className="chart-tip-value">{value}</p>
      <p className={`chart-tip-rating rating-${rating}`}>{RATING_LABEL[rating]}</p>
      {meta ? <p className="chart-tip-meta">{meta}</p> : null}
      {delta ? <p className="chart-tip-delta">{delta}</p> : null}
    </div>
  )
}

function ChartBandKey() {
  return (
    <p className="chart-bands" aria-hidden="true">
      <span>
        <i className="band-key-good" />
        good
      </span>
      <span>
        <i className="band-key-ok" />
        needs improvement
      </span>
      <span>
        <i className="band-key-poor" />
        poor
      </span>
    </p>
  )
}
