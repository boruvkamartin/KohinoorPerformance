import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildChatMessage,
  diffAlerts,
  evaluateAlerts,
  formatAlertValue,
  isWorse,
  median,
  nextAlertState,
  relativeThreshold,
} from './evaluate-alerts.mjs'

const pages = [{ id: 'homepage', label: 'Homepage', url: 'https://eshop.koh-i-noor.cz/' }]

const config = {
  consecutive: 2,
  baselineRuns: 4,
  jumpRatio: 0.5,
  dashboardUrl: 'https://example.test/',
  metrics: {
    lcp: {
      higherIsBetter: false,
      label: 'LCP',
      unit: 'ms',
      minDelta: 3000,
      mobile: { limit: 20000 },
      desktop: { limit: 8000 },
    },
    performance: {
      higherIsBetter: true,
      label: 'Performance',
      unit: 'score',
      minDelta: 12,
      mobile: { limit: 15 },
      desktop: { limit: 40 },
    },
    ttfb: {
      higherIsBetter: false,
      label: 'TTFB',
      unit: 'ms',
      minDelta: 800,
      mobile: { limit: 2000 },
      desktop: { limit: 2000 },
    },
  },
}

function run({ at, profile = 'mobile', status = 'ok', metrics = {}, error = null }) {
  const values = {
    performance: 30,
    fcp: 5000,
    lcp: 9000,
    si: 8000,
    tbt: 800,
    cls: 0.1,
    ttfb: 500,
    ...metrics,
  }
  return {
    id: `${at}|homepage|${profile}`,
    measuredAt: at,
    pageId: 'homepage',
    profile,
    url: 'https://eshop.koh-i-noor.cz/',
    status,
    error,
    metrics: status === 'ok' ? values : null,
  }
}

test('formatAlertValue uses seconds past 1 s', () => {
  assert.equal(formatAlertValue('ms', 24100), '24,1 s')
  assert.equal(formatAlertValue('score', 12.4), '12')
})

test('isWorse respects direction', () => {
  assert.equal(isWorse(21000, 20000, false), true)
  assert.equal(isWorse(19999, 20000, false), false)
  assert.equal(isWorse(12, 15, true), true)
  assert.equal(isWorse(15, 15, true), false)
})

test('median ignores non-finite values', () => {
  assert.equal(median([10, 30, 20]), 20)
  assert.equal(median([10, 20]), 15)
})

test('relativeThreshold uses the larger of ratio and minDelta', () => {
  assert.equal(relativeThreshold(9000, { higherIsBetter: false, minDelta: 3000 }, 0.5), 13500)
  assert.equal(relativeThreshold(30, { higherIsBetter: true, minDelta: 12 }, 0.5), 15)
})

test('evaluateAlerts ignores a single spike', () => {
  const findings = evaluateAlerts(
    [
      run({ at: '2026-08-24T10:00:00.000Z', metrics: { lcp: 9000 } }),
      run({ at: '2026-08-24T10:20:00.000Z', metrics: { lcp: 25000 } }),
    ],
    config,
    pages,
  )
  assert.equal(findings.length, 0)
})

test('evaluateAlerts fires after two consecutive absolute breaches', () => {
  const findings = evaluateAlerts(
    [
      run({ at: '2026-08-24T10:00:00.000Z', metrics: { lcp: 9000 } }),
      run({ at: '2026-08-24T10:20:00.000Z', metrics: { lcp: 25000 } }),
      run({ at: '2026-08-24T10:40:00.000Z', metrics: { lcp: 26000 } }),
    ],
    config,
    pages,
  )
  assert.equal(findings.length, 1)
  assert.equal(findings[0].metricId, 'lcp')
  assert.equal(findings[0].reason, 'absolute')
  assert.equal(findings[0].value, 26000)
  assert.equal(findings[0].key, 'homepage|mobile|lcp')
})

test('evaluateAlerts does not fire when an error breaks the streak', () => {
  const findings = evaluateAlerts(
    [
      run({ at: '2026-08-24T10:00:00.000Z', metrics: { lcp: 25000 } }),
      run({ at: '2026-08-24T10:20:00.000Z', status: 'error', error: 'timeout' }),
      run({ at: '2026-08-24T10:40:00.000Z', metrics: { lcp: 26000 } }),
    ],
    config,
    pages,
  )
  assert.equal(findings.some((finding) => finding.kind === 'metric'), false)
})

test('evaluateAlerts reports two failed lighthouse runs', () => {
  const findings = evaluateAlerts(
    [
      run({ at: '2026-08-24T10:00:00.000Z' }),
      run({ at: '2026-08-24T10:20:00.000Z', status: 'error', error: 'timeout' }),
      run({ at: '2026-08-24T10:40:00.000Z', status: 'error', error: 'chrome died' }),
    ],
    config,
    pages,
  )
  assert.equal(findings.length, 1)
  assert.equal(findings[0].kind, 'error')
  assert.match(findings[0].error, /chrome died/)
})

test('evaluateAlerts fires on a sustained jump against baseline', () => {
  const baseline = [0, 1, 2, 3].map((index) =>
    run({
      at: `2026-08-24T0${index}:00:00.000Z`,
      metrics: { ttfb: 500 },
    }),
  )
  const findings = evaluateAlerts(
    [
      ...baseline,
      run({ at: '2026-08-24T10:00:00.000Z', metrics: { ttfb: 1600 } }),
      run({ at: '2026-08-24T10:20:00.000Z', metrics: { ttfb: 1700 } }),
    ],
    config,
    pages,
  )
  const ttfb = findings.find((finding) => finding.metricId === 'ttfb')
  assert.ok(ttfb)
  assert.equal(ttfb.reason, 'jump')
})

test('evaluateAlerts needs enough baseline before a jump counts', () => {
  const findings = evaluateAlerts(
    [
      run({ at: '2026-08-24T09:00:00.000Z', metrics: { ttfb: 500 } }),
      run({ at: '2026-08-24T10:00:00.000Z', metrics: { ttfb: 1600 } }),
      run({ at: '2026-08-24T10:20:00.000Z', metrics: { ttfb: 1700 } }),
    ],
    config,
    pages,
  )
  assert.equal(findings.some((finding) => finding.metricId === 'ttfb'), false)
})

test('diffAlerts opens once and resolves when the streak clears', () => {
  const openFinding = {
    key: 'homepage|mobile|lcp',
    kind: 'metric',
    pageId: 'homepage',
    profile: 'mobile',
    metricId: 'lcp',
    label: 'LCP',
  }
  const { opened } = diffAlerts([openFinding], {})
  assert.equal(opened.length, 1)
  const again = diffAlerts([openFinding], { [openFinding.key]: openFinding })
  assert.equal(again.opened.length, 0)
  assert.equal(again.resolved.length, 0)
  const cleared = diffAlerts([], { [openFinding.key]: openFinding })
  assert.equal(cleared.resolved.length, 1)
})

test('nextAlertState keeps the original openedAt', () => {
  const finding = {
    key: 'homepage|mobile|lcp',
    kind: 'metric',
    pageId: 'homepage',
    profile: 'mobile',
    metricId: 'lcp',
  }
  const first = nextAlertState([finding], { open: {} }, '2026-08-24T10:00:00.000Z')
  const second = nextAlertState([finding], first, '2026-08-24T11:00:00.000Z')
  assert.equal(second.open[finding.key].openedAt, '2026-08-24T10:00:00.000Z')
  assert.equal(second.updatedAt, '2026-08-24T11:00:00.000Z')
})

test('buildChatMessage lists new breaches and a dashboard link', () => {
  const text = buildChatMessage({
    opened: [
      {
        kind: 'metric',
        pageLabel: 'Homepage',
        profile: 'mobile',
        label: 'LCP',
        unit: 'ms',
        value: 24100,
        limit: 20000,
        reason: 'absolute',
      },
    ],
    resolved: [],
    consecutive: 2,
    dashboardUrl: 'https://example.test/',
  })
  assert.match(text, /rychlost mimo práh/)
  assert.match(text, /Homepage · mobil · LCP \*24,1 s\*/)
  assert.match(text, /hranice 20,0 s/)
  assert.match(text, /example.test/)
})
