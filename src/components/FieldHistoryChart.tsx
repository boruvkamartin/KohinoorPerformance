import { useCallback, useMemo } from 'react'
import { Area, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ChartShell,
  ChartTooltipCard,
  RatingDot,
  ThresholdBands,
} from './ChartChrome'
import {
  chartAxisTick,
  chartCursor,
  formatValueDelta,
  metricYDomain,
  prefersReducedMotion,
  previousInSeries,
  tooltipWrapperStyle,
} from '../lib/chart'
import { formatDate, formatMetricValue, getMetric, rateValue } from '../lib/metrics'
import type { CruxHistoryPoint, FieldMetricId } from '../lib/types'

type FieldPoint = {
  time: number
  value: number
  endDate: string
  firstDate: string | null
}

function FieldTooltip({
  active,
  payload,
  metricId,
  points,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: FieldPoint }>
  metricId: FieldMetricId
  points: FieldPoint[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  if (!point) return null
  const index = points.findIndex((item) => item.time === point.time)
  const window =
    point.firstDate != null
      ? `okno ${formatDate(point.firstDate)} – ${formatDate(point.endDate)}`
      : formatDate(point.endDate)
  return (
    <ChartTooltipCard
      kicker={`${getMetric(metricId).label} · p75`}
      value={formatMetricValue(metricId, point.value)}
      rating={rateValue(metricId, point.value)}
      meta={window}
      delta={formatValueDelta(metricId, point.value, previousInSeries(points.map((item) => item.value), index))}
    />
  )
}

export function FieldHistoryChart({
  points,
  metricId,
}: {
  points: CruxHistoryPoint[]
  metricId: FieldMetricId
}) {
  const metric = getMetric(metricId)
  const series = useMemo(() => {
    const next: FieldPoint[] = []
    for (const point of points) {
      const time = Date.parse(`${point.endDate}T00:00:00Z`)
      const value = point[metricId]
      if (value == null || !Number.isFinite(time) || !Number.isFinite(value)) continue
      next.push({ time, value, endDate: point.endDate, firstDate: point.firstDate })
    }
    return next
  }, [metricId, points])
  const [yMin, yMax] = metricYDomain(metric, series.map((point) => point.value))
  const from = series[0]?.time ?? 0
  const to = series.at(-1)?.time ?? 1
  const animate = !prefersReducedMotion()
  const renderDot = useCallback(
    (props: { cx?: number; cy?: number; value?: unknown; payload?: Record<string, unknown>; dataKey?: unknown }) => (
      <RatingDot
        cx={props.cx}
        cy={props.cy}
        value={props.value}
        payload={props.payload}
        dataKey={props.dataKey}
        metricId={metricId}
        r={4.5}
      />
    ),
    [metricId],
  )
  const renderActiveDot = useCallback(
    (props: { cx?: number; cy?: number; value?: unknown; payload?: Record<string, unknown>; dataKey?: unknown }) => (
      <RatingDot
        cx={props.cx}
        cy={props.cy}
        value={props.value}
        payload={props.payload}
        dataKey={props.dataKey}
        metricId={metricId}
        r={6.5}
      />
    ),
    [metricId],
  )

  return (
    <ChartShell
      title={`${metric.label} · p75`}
      description="Každý bod je 28denní průměr končící daným datem, ne jeden den provozu."
      empty={
        series.length === 0
          ? 'Historie CrUX zatím chybí. Po prvním stažení se tu objeví týdenní body (každý je 28denní okno).'
          : null
      }
      height="field"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 12, right: 28, bottom: 8, left: 4 }} accessibilityLayer>
          <defs>
            <linearGradient id="field-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--prussian)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--prussian)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            type="number"
            domain={[from, to]}
            tickFormatter={(time: number) => formatDate(new Date(time).toISOString().slice(0, 10))}
            tick={chartAxisTick}
            tickLine={false}
            minTickGap={36}
            stroke="var(--ink)"
            axisLine={{ stroke: 'var(--ink)' }}
          />
          <YAxis
            type="number"
            domain={[yMin, yMax]}
            tickFormatter={(value: number) => formatMetricValue(metricId, value)}
            tick={chartAxisTick}
            tickLine={false}
            width={72}
            stroke="var(--ink)"
            axisLine={{ stroke: 'var(--ink)' }}
          />
          <ThresholdBands metric={metric} yMax={yMax} />
          <Area
            type="monotone"
            dataKey="value"
            name={metric.shortLabel}
            stroke="var(--prussian)"
            strokeWidth={2.4}
            fill="url(#field-fill)"
            strokeLinejoin="round"
            strokeLinecap="round"
            isAnimationActive={animate}
            animationDuration={450}
            dot={renderDot}
            activeDot={renderActiveDot}
          />
          <Tooltip
            cursor={chartCursor}
            wrapperStyle={tooltipWrapperStyle}
            isAnimationActive={false}
            content={(props) => (
              <FieldTooltip active={props.active} payload={props.payload} metricId={metricId} points={series} />
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
