import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendRuns,
  createEmptyMetricsFile,
  createErrorRun,
  createRunId,
  parseLighthouseResult,
  RETENTION_MS,
  sanitizeError,
} from './parse-lighthouse.mjs'

const context = {
  id: 'run-1',
  measuredAt: '2026-08-24T12:00:00.000Z',
  pageId: 'homepage',
  profile: 'mobile',
  url: 'https://eshop.koh-i-noor.cz/',
}

test('parseLighthouseResult maps scores and numeric audits', () => {
  const run = parseLighthouseResult(
    {
      categories: { performance: { score: 0.724 } },
      audits: {
        'first-contentful-paint': { numericValue: 1820.4 },
        'largest-contentful-paint': { numericValue: 2510 },
        'speed-index': { numericValue: 3401 },
        'total-blocking-time': { numericValue: 180 },
        'cumulative-layout-shift': { numericValue: 0.0421 },
        'server-response-time': { numericValue: 412 },
      },
    },
    context,
  )

  assert.equal(run.status, 'ok')
  assert.equal(run.error, null)
  assert.equal(run.metrics.performance, 72)
  assert.equal(run.metrics.fcp, 1820.4)
  assert.equal(run.metrics.lcp, 2510)
  assert.equal(run.metrics.cls, 0.0421)
  assert.equal(run.metrics.ttfb, 412)
  assert.equal(run.url, context.url)
})

test('parseLighthouseResult keeps missing audits as null', () => {
  const run = parseLighthouseResult({ categories: {}, audits: {} }, context)
  assert.equal(run.status, 'ok')
  assert.equal(run.metrics.performance, null)
  assert.equal(run.metrics.lcp, null)
  assert.equal(run.metrics.cls, null)
})

test('createErrorRun stores a sanitized compact error', () => {
  const run = createErrorRun(context, new Error('Failed at D:\\secret\\token.json'))
  assert.equal(run.status, 'error')
  assert.equal(run.metrics, null)
  assert.equal(run.error.includes('secret'), false)
  assert.match(run.error, /Failed at/)
})

test('sanitizeError strips posix paths and truncates', () => {
  const long = `boom /var/lib/lighthouse/${'x'.repeat(400)}`
  const sanitized = sanitizeError(new Error(long))
  assert.equal(sanitized.includes('/var/lib'), false)
  assert.ok(sanitized.length <= 280)
})

test('appendRuns keeps chronological history and prunes old records', () => {
  const pages = [{ id: 'homepage', label: 'Homepage', url: context.url }]
  const now = Date.parse('2026-08-24T12:00:00.000Z')
  const staleAt = new Date(now - RETENTION_MS - 60_000).toISOString()
  const freshAt = new Date(now - 60_000).toISOString()
  const file = createEmptyMetricsFile(pages)
  file.runs = [
    {
      id: createRunId(staleAt, 'homepage', 'mobile'),
      measuredAt: staleAt,
      pageId: 'homepage',
      profile: 'mobile',
      url: context.url,
      status: 'ok',
      error: null,
      metrics: { performance: 10, fcp: 1, lcp: 1, si: 1, tbt: 1, cls: 0, ttfb: 1 },
    },
  ]

  const next = appendRuns(
    file,
    [
      {
        id: createRunId(freshAt, 'homepage', 'desktop'),
        measuredAt: freshAt,
        pageId: 'homepage',
        profile: 'desktop',
        url: context.url,
        status: 'error',
        error: 'timeout',
        metrics: null,
      },
    ],
    now,
  )

  assert.equal(next.runs.length, 1)
  assert.equal(next.runs[0].profile, 'desktop')
  assert.equal(next.generatedAt, new Date(now).toISOString())
})
