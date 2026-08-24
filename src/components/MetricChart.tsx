import { useMemo, useState } from 'react'
import type { MetricId, MetricRun } from '../lib/types'
import {
  formatDateTime,
  formatMetricValue,
  getMetric,
  rateValue,
} from '../lib/metrics'
import { metricSeries, timeAxisTicks } from '../lib/series'

type MetricChartProps = {
  runs: MetricRun[]
  metricId: MetricId
  from: number
  to: number
  rangeLabel: string
}

const WIDTH = 960
const HEIGHT = 340
const PAD = { top: 24, right: 18, bottom: 42, left: 78 }

function scale(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  if (inMax === inMin) return (outMin + outMax) / 2
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

export function MetricChart({ runs, metricId, from, to, rangeLabel }: MetricChartProps) {
  const metric = getMetric(metricId)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const points = useMemo(
    () => metricSeries(runs, metricId).filter((point) => point.time >= from && point.time <= to),
    [from, metricId, runs, to],
  )
  const errors = runs.filter((run) => {
    if (run.status !== 'error') return false
    const time = Date.parse(run.measuredAt)
    return Number.isFinite(time) && time >= from && time <= to
  })

  const maxValue = Math.max(
    metric.higherIsBetter ? 100 : metric.poor * 1.25,
    ...points.map((point) => point.value),
  )
  const minValue = metric.higherIsBetter ? 0 : 0
  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom

  const x = (time: number) => scale(time, from, to, PAD.left, WIDTH - PAD.right)
  const y = (value: number) => scale(value, minValue, maxValue, HEIGHT - PAD.bottom, PAD.top)

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.time)} ${y(point.value)}`)
    .join(' ')

  const goodY = y(metric.good)
  const poorY = y(metric.poor)
  const hover = hoverIndex != null ? points[hoverIndex] : null

  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, index) => {
    const value = minValue + ((maxValue - minValue) * index) / ticks
    return { value, pos: y(value) }
  })

  const xTicks = timeAxisTicks(from, to)

  return (
    <figure className="chart">
      <figcaption>
        <strong>{metric.label}</strong>
        <span>
          {metric.description} {rangeLabel}.
        </span>
      </figcaption>
      {points.length === 0 ? (
        <div className="chart-empty">
          V tomto výřezu zatím nejsou úspěšné hodnoty. Graf se doplní po prvním Lighthouse běhu.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${metric.label} · ${rangeLabel}`}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <rect className="chart-paper" x="0" y="0" width={WIDTH} height={HEIGHT} />
          {Array.from({ length: 9 }, (_, index) => (
            <line
              key={index}
              className="chart-rule"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={PAD.top + (innerH * index) / 8}
              y2={PAD.top + (innerH * index) / 8}
            />
          ))}
          {metric.higherIsBetter ? (
            <>
              <rect className="band-good" x={PAD.left} y={PAD.top} width={innerW} height={Math.max(goodY - PAD.top, 0)} />
              <rect className="band-ok" x={PAD.left} y={goodY} width={innerW} height={Math.max(poorY - goodY, 0)} />
              <rect className="band-poor" x={PAD.left} y={poorY} width={innerW} height={Math.max(HEIGHT - PAD.bottom - poorY, 0)} />
            </>
          ) : (
            <>
              <rect className="band-good" x={PAD.left} y={goodY} width={innerW} height={Math.max(HEIGHT - PAD.bottom - goodY, 0)} />
              <rect className="band-ok" x={PAD.left} y={poorY} width={innerW} height={Math.max(goodY - poorY, 0)} />
              <rect className="band-poor" x={PAD.left} y={PAD.top} width={innerW} height={Math.max(poorY - PAD.top, 0)} />
            </>
          )}
          {yTicks.map((tick) => (
            <text key={tick.value} className="chart-tick" x={PAD.left - 8} y={tick.pos + 4} textAnchor="end">
              {formatMetricValue(metricId, tick.value)}
            </text>
          ))}
          {xTicks.map((tick) => (
            <text key={tick.time} className="chart-tick" x={x(tick.time)} y={HEIGHT - 14} textAnchor="middle">
              {tick.label}
            </text>
          ))}
          {path && <path className="chart-line" d={path} />}
          {points.map((point, index) => (
            <circle
              key={point.run.id}
              className={`chart-dot rating-${rateValue(metricId, point.value)}`}
              cx={x(point.time)}
              cy={y(point.value)}
              r={hoverIndex === index ? 6 : 3.5}
              onMouseEnter={() => setHoverIndex(index)}
            />
          ))}
          {errors.map((run) => {
            const time = Date.parse(run.measuredAt)
            if (!Number.isFinite(time)) return null
            return (
              <line
                key={run.id}
                className="chart-error"
                x1={x(time)}
                x2={x(time)}
                y1={HEIGHT - PAD.bottom}
                y2={HEIGHT - PAD.bottom + 8}
              />
            )
          })}
          {hover && (
            <g className="chart-tooltip">
              <line
                x1={x(hover.time)}
                x2={x(hover.time)}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
              />
              <rect
                x={Math.min(x(hover.time) + 10, WIDTH - 210)}
                y={Math.max(y(hover.value) - 46, 8)}
                width="196"
                height="40"
                rx="2"
              />
              <text
                x={Math.min(x(hover.time) + 20, WIDTH - 200)}
                y={Math.max(y(hover.value) - 22, 32)}
              >
                {formatDateTime(hover.run.measuredAt)} · {formatMetricValue(metricId, hover.value)}
              </text>
            </g>
          )}
        </svg>
      )}
    </figure>
  )
}
