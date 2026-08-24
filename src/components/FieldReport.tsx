import type { CSSProperties } from 'react'
import { useState } from 'react'
import {
  FIELD_METRICS,
  formatDate,
  formatDateTime,
  formatMetricValue,
  formatPercent,
  formatRelative,
  getMetric,
  rateValue,
} from '../lib/metrics'
import type {
  CruxFile,
  CruxHistoryPoint,
  CruxRecord,
  FieldMetricId,
  FormFactor,
  PageId,
  PageTarget,
  Profile,
} from '../lib/types'

type FieldReportProps = {
  data: CruxFile | null
  pages: PageTarget[]
  pageId: PageId | 'all'
  profile: Profile
}

function profileToFormFactor(profile: Profile): FormFactor {
  return profile === 'mobile' ? 'PHONE' : 'DESKTOP'
}

function pickRecord(records: CruxRecord[], pageId: PageId | 'all', formFactor: FormFactor) {
  if (pageId !== 'all') {
    const page = records.find(
      (record) => record.pageId === pageId && record.formFactor === formFactor && record.status === 'ok',
    )
    if (page) return { record: page, usedOrigin: false }
  }
  const origin = records.find(
    (record) => record.pageId === 'origin' && record.formFactor === formFactor && record.status === 'ok',
  )
  const allDevices = records.find(
    (record) => record.pageId === 'origin' && record.formFactor === 'ALL' && record.status === 'ok',
  )
  const record = origin ?? allDevices ?? null
  return { record, usedOrigin: pageId !== 'all' }
}

export function FieldReport({ data, pages, pageId, profile }: FieldReportProps) {
  const [metricId, setMetricId] = useState<FieldMetricId>('lcp')
  const formFactor = profileToFormFactor(profile)
  const { record, usedOrigin } = pickRecord(data?.records ?? [], pageId, formFactor)
  const history = (data?.history ?? []).find(
    (series) => series.pageId === 'origin' && series.formFactor === formFactor && series.status === 'ok',
  ) ?? (data?.history ?? []).find(
    (series) => series.pageId === 'origin' && series.formFactor === 'ALL' && series.status === 'ok',
  )
  const pageLabel =
    pageId === 'all' ? 'celý e-shop' : pages.find((page) => page.id === pageId)?.label ?? pageId
  const period = record?.collectionPeriod

  return (
    <section className="field">
      <div className="table-head">
        <h2>Reální uživatelé (Chrome UX Report)</h2>
        <p>
          Field data z Chrome: 75. percentil za klouzavých 28 dní. Google je zveřejňuje jednou denně
          (obvykle kolem 6:00 SELČ, se zpožděním cca 1–2 dny). Jedna úprava se v číslech projeví
          postupně, plně až po 28 dnech. Stránka bez dostatku návštěv v CrUX není; pak ukazujeme origin.
        </p>
      </div>
      <p className="field-meta">
        {data?.generatedAt
          ? `Staženo ${formatDateTime(data.generatedAt)} (${formatRelative(data.generatedAt)}).`
          : 'Ještě nenačteno. Přidejte GitHub secret CRUX_API_KEY a spusťte workflow CrUX field data.'}
        {period
          ? ` Okno: ${formatDate(period.firstDate)} – ${formatDate(period.lastDate)}.`
          : ''}
        {` Zobrazení: ${pageLabel} · ${profile === 'mobile' ? 'telefon' : 'desktop'}${usedOrigin ? ' (fallback na origin)' : ''}.`}
      </p>
      {!record ? (
        <p className="banner">
          Zatím tu nejsou field data. Po nastavení `CRUX_API_KEY` je workflow stáhne jednou denně,
          nebo ručně přes Actions → CrUX field data.
        </p>
      ) : (
        <>
          <div className="field-cards">
            {FIELD_METRICS.map((metric) => {
              const dist = record.metrics?.[metric.id]
              const rating = rateValue(metric.id, dist?.p75 ?? null)
              const style = { '--pan-rating': `var(--${rating})` } as CSSProperties
              return (
                <article key={metric.id} className={`field-card rating-${rating}`} style={style}>
                  <h3>{metric.shortLabel}</h3>
                  <strong>{formatMetricValue(metric.id, dist?.p75 ?? null)}</strong>
                  <p>p75 · {metric.label}</p>
                  <div className="dist" aria-label="Rozložení hodnocení">
                    <span className="dist-good" style={{ flexGrow: dist?.good ?? 0 }} />
                    <span className="dist-ok" style={{ flexGrow: dist?.ni ?? 0 }} />
                    <span className="dist-poor" style={{ flexGrow: dist?.poor ?? 0 }} />
                  </div>
                  <small>
                    {formatPercent(dist?.good)} good · {formatPercent(dist?.ni)} NI · {formatPercent(dist?.poor)} poor
                  </small>
                </article>
              )
            })}
          </div>
          <div className="filters">
            <fieldset>
              <legend>Historie originu</legend>
              <div className="metric-row">
                {FIELD_METRICS.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    className={metricId === metric.id ? 'is-active' : ''}
                    aria-pressed={metricId === metric.id}
                    onClick={() => setMetricId(metric.id)}
                  >
                    {metric.shortLabel}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <FieldHistoryChart points={history?.points ?? []} metricId={metricId} />
        </>
      )}
    </section>
  )
}

function FieldHistoryChart({
  points,
  metricId,
}: {
  points: CruxHistoryPoint[]
  metricId: FieldMetricId
}) {
  const metric = getMetric(metricId)
  const series = points
    .map((point) => ({
      time: Date.parse(`${point.endDate}T00:00:00Z`),
      value: point[metricId],
      label: point.endDate,
    }))
    .filter((point) => point.value != null && Number.isFinite(point.time)) as {
    time: number
    value: number
    label: string
  }[]

  if (series.length === 0) {
    return (
      <div className="chart-empty">
        Historie CrUX zatím chybí. Po prvním stažení se tu objeví týdenní body (každý je 28denní okno).
      </div>
    )
  }

  const width = 960
  const height = 260
  const pad = { top: 20, right: 16, bottom: 36, left: 72 }
  const min = 0
  const max = Math.max(metric.poor * 1.2, ...series.map((point) => point.value))
  const x = (time: number) => {
    const first = series[0].time
    const last = series[series.length - 1].time
    if (last === first) return pad.left + (width - pad.left - pad.right) / 2
    return pad.left + ((time - first) / (last - first)) * (width - pad.left - pad.right)
  }
  const y = (value: number) =>
    height - pad.bottom - ((value - min) / (max - min || 1)) * (height - pad.top - pad.bottom)
  const path = series
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.time)} ${y(point.value)}`)
    .join(' ')

  return (
    <figure className="chart">
      <figcaption>
        <strong>{metric.label} · p75</strong>
        <span>Každý bod je 28denní průměr končící daným datem, ne jeden den provozu.</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric.label} historie CrUX`}>
        <rect className="chart-paper" x="0" y="0" width={width} height={height} />
        <text className="chart-tick" x={pad.left - 8} y={y(max) + 4} textAnchor="end">
          {formatMetricValue(metricId, max)}
        </text>
        <text className="chart-tick" x={pad.left - 8} y={y(min) + 4} textAnchor="end">
          {formatMetricValue(metricId, min)}
        </text>
        <text className="chart-tick" x={x(series[0].time)} y={height - 12} textAnchor="middle">
          {formatDate(series[0].label)}
        </text>
        <text
          className="chart-tick"
          x={x(series[series.length - 1].time)}
          y={height - 12}
          textAnchor="middle"
        >
          {formatDate(series[series.length - 1].label)}
        </text>
        <path className="chart-line" d={path} />
        {series.map((point) => (
          <circle
            key={point.label}
            className={`chart-dot rating-${rateValue(metricId, point.value)}`}
            cx={x(point.time)}
            cy={y(point.value)}
            r="3.5"
          />
        ))}
      </svg>
    </figure>
  )
}
