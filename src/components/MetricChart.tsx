import { useCallback, useMemo, useState } from 'react'
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartShell,
  ChartTooltipCard,
  RatingDot,
  ThresholdBands,
} from './ChartChrome'
import {
  SERIES_COLORS,
  chartAxisTick,
  chartCursor,
  formatValueDelta,
  metricYDomain,
  prefersReducedMotion,
  tooltipWrapperStyle,
} from '../lib/chart'
import { formatDateTime, formatMetricValue, getMetric, rateValue } from '../lib/metrics'
import { formatAxisTime, metricSeries } from '../lib/series'
import type { MetricId, MetricRun, PageId, PageTarget } from '../lib/types'

type MetricChartProps = {
  runs: MetricRun[]
  pages: PageTarget[]
  metricId: MetricId
  from: number
  to: number
  rangeLabel: string
}

type ChartRow = {
  time: number
} & Partial<Record<PageId, number>>

type ErrorPoint = {
  time: number
  marker: number
  pageId: PageId
  measuredAt: string
  error: string | null
}

type TooltipEntry = {
  dataKey?: unknown
  value?: unknown
  payload?: ChartRow | ErrorPoint
}

function buildRows(points: ReturnType<typeof metricSeries>): ChartRow[] {
  const map = new Map<number, ChartRow>()
  for (const point of points) {
    const row = map.get(point.time) ?? { time: point.time }
    row[point.run.pageId] = point.value
    map.set(point.time, row)
  }
  return [...map.values()].sort((a, b) => a.time - b.time)
}

function previousForPage(rows: ChartRow[], pageId: PageId, time: number) {
  let previous: number | undefined
  for (const row of rows) {
    if (row.time >= time) break
    const value = row[pageId]
    if (value != null) previous = value
  }
  return previous
}

function LabTooltip({
  active,
  payload,
  metricId,
  rows,
  pages,
}: {
  active?: boolean
  payload?: ReadonlyArray<TooltipEntry>
  metricId: MetricId
  rows: ChartRow[]
  pages: PageTarget[]
}) {
  if (!active || !payload || payload.length === 0) return null

  const errorEntry = payload.find((entry) => entry.dataKey === 'marker')
  if (errorEntry) {
    const point = errorEntry.payload as ErrorPoint
    const page = pages.find((item) => item.id === point.pageId)
    return (
      <ChartTooltipCard
        kicker={`${page?.label ?? point.pageId} · chyba měření`}
        value="neproběhlo"
        rating="poor"
        meta={`${formatDateTime(point.measuredAt)}${point.error ? ` · ${point.error}` : ''}`}
      />
    )
  }

  const entry = payload.find((item) => item.dataKey !== 'marker') ?? payload[0]
  const pageId = entry.dataKey as PageId
  const value = typeof entry.value === 'number' ? entry.value : Number(entry.value)
  if (!Number.isFinite(value)) return null
  const row = entry.payload as ChartRow
  const page = pages.find((item) => item.id === pageId)
  return (
    <ChartTooltipCard
      kicker={page?.label ?? pageId}
      value={formatMetricValue(metricId, value)}
      rating={rateValue(metricId, value)}
      meta={formatDateTime(new Date(row.time).toISOString())}
      delta={formatValueDelta(metricId, value, previousForPage(rows, pageId, row.time))}
    />
  )
}

function ErrorTick({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null
  return (
    <path
      className="chart-error"
      d={`M ${cx} ${cy - 1} L ${cx - 4.5} ${cy - 10} L ${cx + 4.5} ${cy - 10} Z`}
    />
  )
}

export function MetricChart({ runs, pages, metricId, from, to, rangeLabel }: MetricChartProps) {
  const metric = getMetric(metricId)
  const [hidden, setHidden] = useState<ReadonlySet<PageId>>(() => new Set())
  const points = useMemo(
    () => metricSeries(runs, metricId).filter((point) => point.time >= from && point.time <= to),
    [from, metricId, runs, to],
  )
  const rows = useMemo(() => buildRows(points), [points])
  const series = useMemo(
    () =>
      pages
        .map((page) => ({
          page,
          count: points.filter((point) => point.run.pageId === page.id).length,
        }))
        .filter((item) => item.count > 0),
    [pages, points],
  )
  const visibleSeries = series.filter((item) => !hidden.has(item.page.id))
  const plotted = visibleSeries.length > 0 ? visibleSeries : series
  const errors = useMemo<ErrorPoint[]>(
    () =>
      runs.flatMap((run) => {
        if (run.status !== 'error') return []
        const time = Date.parse(run.measuredAt)
        if (!Number.isFinite(time) || time < from || time > to) return []
        return [
          {
            time,
            marker: 0,
            pageId: run.pageId,
            measuredAt: run.measuredAt,
            error: run.error,
          },
        ]
      }),
    [from, runs, to],
  )

  const plottedIds = new Set(plotted.map((item) => item.page.id))
  const [yMin, yMax] = metricYDomain(
    metric,
    points.filter((point) => plottedIds.has(point.run.pageId)).map((point) => point.value),
  )
  const showDots = plotted.length === 1 && rows.length <= 56
  const filled = plotted.length === 1
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
        r={6}
      />
    ),
    [metricId],
  )

  function togglePage(pageId: PageId) {
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }

  return (
    <ChartShell
      title={metric.label}
      description={`${metric.description} ${rangeLabel}.`}
      empty={
        points.length === 0
          ? 'V tomto výřezu zatím nejsou úspěšné hodnoty. Graf se doplní po prvním Lighthouse běhu.'
          : null
      }
      legend={
        series.length > 1 ? (
          <div className="chart-legend" aria-label="Legenda měřených URL">
            {series.map(({ page }) => (
              <button
                key={page.id}
                type="button"
                className={`series-${page.id}${hidden.has(page.id) ? ' is-off' : ''}`}
                aria-pressed={!hidden.has(page.id)}
                onClick={() => togglePage(page.id)}
              >
                <i aria-hidden="true" />
                {page.label}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 12, right: 28, bottom: 8, left: 4 }} accessibilityLayer>
          <defs>
            {plotted.map(({ page }) => (
              <linearGradient key={page.id} id={`lab-fill-${page.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS[page.id]} stopOpacity={0.32} />
                <stop offset="100%" stopColor={SERIES_COLORS[page.id]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            dataKey="time"
            type="number"
            domain={[from, to]}
            tickFormatter={(time: number) => formatAxisTime(time, from, to)}
            tick={chartAxisTick}
            tickLine={false}
            minTickGap={28}
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
          {errors.map((point) => (
            <ReferenceLine
              key={`${point.pageId}-${point.time}`}
              x={point.time}
              stroke="var(--poor)"
              strokeDasharray="2 4"
              strokeOpacity={0.28}
            />
          ))}
          {plotted.map(({ page }) => {
            const color = SERIES_COLORS[page.id]
            const shared = {
              dataKey: page.id,
              name: page.label,
              type: 'monotone' as const,
              stroke: color,
              strokeWidth: 2.4,
              connectNulls: true,
              isAnimationActive: animate,
              animationDuration: 450,
              dot: showDots ? renderDot : false,
              activeDot: renderActiveDot,
            }
            return filled ? (
              <Area
                key={page.id}
                {...shared}
                fill={`url(#lab-fill-${page.id})`}
                fillOpacity={1}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : (
              <Line key={page.id} {...shared} dot={showDots ? renderDot : false} strokeLinejoin="round" />
            )
          })}
          {errors.length > 0 && (
            <Scatter
              data={errors}
              dataKey="marker"
              name="Chyba měření"
              fill="var(--poor)"
              isAnimationActive={false}
              shape={ErrorTick}
              legendType="none"
            />
          )}
          <Tooltip
            shared={false}
            cursor={chartCursor}
            wrapperStyle={tooltipWrapperStyle}
            isAnimationActive={false}
            content={(props) => (
              <LabTooltip
                active={props.active}
                payload={props.payload}
                metricId={metricId}
                rows={rows}
                pages={pages}
              />
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
