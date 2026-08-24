import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCruxHistory, parseCruxRecord, parseP75 } from './parse-crux.mjs'

const context = {
  pageId: 'origin',
  url: 'https://eshop.koh-i-noor.cz',
  scope: 'origin',
  formFactor: 'PHONE',
}

test('parseP75 accepts numbers and numeric strings', () => {
  assert.equal(parseP75(2216), 2216)
  assert.equal(parseP75('0.05'), 0.05)
  assert.equal(parseP75(null), null)
})

test('parseCruxRecord maps p75 and histogram densities', () => {
  const run = parseCruxRecord(
    {
      record: {
        collectionPeriod: {
          firstDate: { year: 2026, month: 7, day: 27 },
          lastDate: { year: 2026, month: 8, day: 23 },
        },
        metrics: {
          largest_contentful_paint: {
            histogram: [
              { start: 0, end: 2500, density: 0.71 },
              { start: 2500, end: 4000, density: 0.2 },
              { start: 4000, density: 0.09 },
            ],
            percentiles: { p75: 2410 },
          },
          cumulative_layout_shift: {
            histogram: [{ density: 0.8 }, { density: 0.15 }, { density: 0.05 }],
            percentiles: { p75: '0.08' },
          },
        },
      },
    },
    context,
  )

  assert.equal(run.status, 'ok')
  assert.equal(run.collectionPeriod.firstDate, '2026-07-27')
  assert.equal(run.metrics.lcp.p75, 2410)
  assert.equal(run.metrics.lcp.good, 0.71)
  assert.equal(run.metrics.cls.p75, 0.08)
  assert.equal(run.metrics.inp.p75, null)
})

test('parseCruxRecord maps missing page traffic to insufficient-data', () => {
  const run = parseCruxRecord(
    { error: { code: 404, message: 'chrome ux report data not found', status: 'NOT_FOUND' } },
    { ...context, pageId: 'basket', scope: 'url' },
  )
  assert.equal(run.status, 'insufficient-data')
  assert.equal(run.metrics, null)
})

test('parseCruxHistory aligns weekly p75 points with collection periods', () => {
  const history = parseCruxHistory(
    {
      record: {
        collectionPeriods: [
          { firstDate: { year: 2026, month: 7, day: 20 }, lastDate: { year: 2026, month: 8, day: 16 } },
          { firstDate: { year: 2026, month: 7, day: 27 }, lastDate: { year: 2026, month: 8, day: 23 } },
        ],
        metrics: {
          largest_contentful_paint: { percentilesTimeseries: { p75s: [2500, 2410] } },
          interaction_to_next_paint: { percentilesTimeseries: { p75s: [180, 160] } },
        },
      },
    },
    context,
  )

  assert.equal(history.status, 'ok')
  assert.equal(history.points.length, 2)
  assert.equal(history.points[1].endDate, '2026-08-23')
  assert.equal(history.points[1].lcp, 2410)
  assert.equal(history.points[1].inp, 160)
})
