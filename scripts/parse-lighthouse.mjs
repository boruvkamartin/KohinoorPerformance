export const RETENTION_DAYS = 8
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

function emptyMetrics() {
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

const AUDIT_IDS = {
  fcp: 'first-contentful-paint',
  lcp: 'largest-contentful-paint',
  si: 'speed-index',
  tbt: 'total-blocking-time',
  cls: 'cumulative-layout-shift',
  ttfb: 'server-response-time',
}

export function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/[A-Za-z]:\\[^\s]+/g, '[path]').replace(/\/[^\s]+/g, '[path]').slice(0, 280)
}

export function numericAudit(lhr, auditId) {
  const value = lhr?.audits?.[auditId]?.numericValue
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function parseLighthouseResult(lhr, context) {
  const performanceScore = lhr?.categories?.performance?.score
  const metrics = emptyMetrics()
  metrics.performance =
    typeof performanceScore === 'number' && Number.isFinite(performanceScore)
      ? Math.round(performanceScore * 100)
      : null
  metrics.fcp = numericAudit(lhr, AUDIT_IDS.fcp)
  metrics.lcp = numericAudit(lhr, AUDIT_IDS.lcp)
  metrics.si = numericAudit(lhr, AUDIT_IDS.si)
  metrics.tbt = numericAudit(lhr, AUDIT_IDS.tbt)
  metrics.cls = numericAudit(lhr, AUDIT_IDS.cls)
  metrics.ttfb = numericAudit(lhr, AUDIT_IDS.ttfb)

  return {
    id: context.id,
    measuredAt: context.measuredAt,
    pageId: context.pageId,
    profile: context.profile,
    url: context.url,
    status: 'ok',
    error: null,
    metrics,
  }
}

export function createErrorRun(context, error) {
  return {
    id: context.id,
    measuredAt: context.measuredAt,
    pageId: context.pageId,
    profile: context.profile,
    url: context.url,
    status: 'error',
    error: sanitizeError(error),
    metrics: null,
  }
}

export function createEmptyMetricsFile(pages) {
  return {
    version: 1,
    generatedAt: null,
    pages,
    runs: [],
  }
}

export function appendRuns(file, runs, now = Date.now()) {
  const cutoff = now - RETENTION_MS
  const nextRuns = [...(file.runs ?? []), ...runs]
    .filter((run) => {
      const timestamp = Date.parse(run.measuredAt)
      return Number.isFinite(timestamp) && timestamp >= cutoff
    })
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt) || a.id.localeCompare(b.id))

  return {
    version: 1,
    generatedAt: new Date(now).toISOString(),
    pages: file.pages,
    runs: nextRuns,
  }
}

export function createRunId(measuredAt, pageId, profile) {
  return `${measuredAt}|${pageId}|${profile}`
}
