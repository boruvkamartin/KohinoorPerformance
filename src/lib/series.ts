import type { MetricId, MetricRun, PageId, Profile } from '../lib/types'
import { HISTORY_DAYS } from '../lib/metrics'

export function lastDaysWindow(now = Date.now()) {
  return {
    from: now - HISTORY_DAYS * 24 * 60 * 60 * 1000,
    to: now,
  }
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
