export const CRUX_METRIC_IDS = {
  lcp: 'largest_contentful_paint',
  inp: 'interaction_to_next_paint',
  cls: 'cumulative_layout_shift',
  fcp: 'first_contentful_paint',
  ttfb: 'experimental_time_to_first_byte',
}

export const CRUX_METRICS = Object.keys(CRUX_METRIC_IDS)

export function parseP75(value) {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

export function parseHistogram(metric) {
  const bins = Array.isArray(metric?.histogram) ? metric.histogram : []
  return {
    p75: parseP75(metric?.percentiles?.p75),
    good: parseP75(bins[0]?.density),
    ni: parseP75(bins[1]?.density),
    poor: parseP75(bins[2]?.density),
  }
}

export function parseCollectionPeriod(period) {
  if (!period?.firstDate || !period?.lastDate) return null
  return {
    firstDate: toIsoDate(period.firstDate),
    lastDate: toIsoDate(period.lastDate),
  }
}

export function toIsoDate(parts) {
  if (!parts) return null
  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)
  if (![year, month, day].every(Number.isFinite)) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseCruxRecord(payload, context) {
  const record = payload?.record
  if (!record?.metrics) {
    return {
      ...context,
      status: payload?.error?.status === 'NOT_FOUND' ? 'insufficient-data' : 'error',
      error: payload?.error?.message ?? 'CrUX nevrátil záznam',
      collectionPeriod: null,
      metrics: null,
    }
  }

  const metrics = {}
  for (const [id, apiId] of Object.entries(CRUX_METRIC_IDS)) {
    metrics[id] = parseHistogram(record.metrics[apiId])
  }

  return {
    ...context,
    status: 'ok',
    error: null,
    collectionPeriod: parseCollectionPeriod(record.collectionPeriod),
    metrics,
  }
}

export function parseCruxHistory(payload, context) {
  const record = payload?.record
  if (!record?.metrics || !Array.isArray(record.collectionPeriods)) {
    return {
      ...context,
      status: payload?.error?.status === 'NOT_FOUND' ? 'insufficient-data' : 'error',
      error: payload?.error?.message ?? 'CrUX historie chybí',
      points: [],
    }
  }

  const periods = record.collectionPeriods
  const series = {}
  for (const [id, apiId] of Object.entries(CRUX_METRIC_IDS)) {
    series[id] = record.metrics[apiId]?.percentilesTimeseries?.p75s ?? []
  }

  const points = periods
    .map((period, index) => ({
      endDate: toIsoDate(period.lastDate),
      firstDate: toIsoDate(period.firstDate),
      lcp: parseP75(series.lcp[index]),
      inp: parseP75(series.inp[index]),
      cls: parseP75(series.cls[index]),
      fcp: parseP75(series.fcp[index]),
      ttfb: parseP75(series.ttfb[index]),
    }))
    .filter((point) => point.endDate)
    .slice(-26)

  return {
    ...context,
    status: 'ok',
    error: null,
    points,
  }
}

export function createEmptyCruxFile(origin) {
  return {
    version: 1,
    generatedAt: null,
    origin,
    records: [],
    history: [],
  }
}
