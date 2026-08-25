import type { MetricId, MetricRun, PageId, Profile } from './types'
import { DAY_MS } from './metrics'

export const RANGE_DAYS = [1, 2, 3, 7] as const
export type RangeDays = (typeof RANGE_DAYS)[number]

export function lastDaysWindow(days: number, now = Date.now()) {
  return {
    from: now - days * DAY_MS,
    to: now,
  }
}

export function formatRangeLabel(days: number) {
  if (days === 1) return 'Poslední den'
  if (days < 5) return `Poslední ${days} dny`
  return `Posledních ${days} dní`
}

export function fitTimeWindow(runs: MetricRun[], requestedFrom: number, requestedTo: number) {
  const times = runs
    .map((run) => Date.parse(run.measuredAt))
    .filter((time) => Number.isFinite(time) && time >= requestedFrom && time <= requestedTo)

  if (times.length === 0) {
    return { from: requestedFrom, to: requestedTo, fitted: false }
  }

  const min = Math.min(...times)
  const max = Math.max(...times)
  const span = Math.max(max - min, 30 * 60 * 1000)
  const pad = Math.max(span * 0.06, 10 * 60 * 1000)

  return {
    from: min - pad,
    to: max + pad,
    fitted: min - requestedFrom > 60 * 60 * 1000 || requestedTo - max > 60 * 60 * 1000,
  }
}

export function formatAxisTime(time: number, from: number, to: number) {
  const span = Math.max(to - from, 1)
  const hour = 60 * 60 * 1000
  if (span <= 8 * hour) {
    return new Date(time).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
  }
  if (span <= 2 * DAY_MS) {
    return new Date(time).toLocaleString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return new Date(time).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
}

export function runsInWindow(runs: MetricRun[], from: number, to: number) {
  return runs.filter((run) => {
    const time = Date.parse(run.measuredAt)
    return Number.isFinite(time) && time >= from && time <= to
  })
}

export function filterRuns(
  runs: MetricRun[],
  pageId: PageId | 'all',
  profile: Profile,
) {
  return runs.filter((run) => {
    if (run.profile !== profile) return false
    if (pageId !== 'all' && run.pageId !== pageId) return false
    return true
  })
}

export function latestRun(
  runs: MetricRun[],
  pageId: PageId,
  profile: Profile,
) {
  return [...runs]
    .reverse()
    .find((run) => run.pageId === pageId && run.profile === profile)
}

export function latestGeneratedAt(runs: MetricRun[]) {
  const newest = [...runs].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0]
  return newest?.measuredAt ?? null
}

export function metricSeries(runs: MetricRun[], metricId: MetricId) {
  return runs
    .filter((run) => run.status === 'ok' && run.metrics?.[metricId] != null)
    .map((run) => ({
      time: Date.parse(run.measuredAt),
      value: run.metrics![metricId] as number,
      run,
    }))
    .sort((a, b) => a.time - b.time)
}

export function failedRuns(runs: MetricRun[]) {
  return runs.filter((run) => run.status === 'error')
}
