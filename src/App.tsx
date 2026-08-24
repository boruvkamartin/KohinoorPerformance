/* oxlint-disable set-state-in-effect -- App loads metrics on mount and from Obnovit data */
import { useEffect, useMemo, useState } from 'react'
import { Filters } from './components/Filters'
import { MetricChart } from './components/MetricChart'
import { PagePans } from './components/PagePans'
import { RunsTable } from './components/RunsTable'
import { PAGES } from './config/site'
import { loadMetricsFile } from './lib/data'
import { formatDateTime, formatRelative, getMetric } from './lib/metrics'
import { failedRuns, filterRuns, lastDaysWindow, latestGeneratedAt, runsInWindow } from './lib/series'
import type { MetricId, MetricsFile, PageId, Profile } from './lib/types'

function App() {
  const [data, setData] = useState<MetricsFile | null>(null)
  const [source, setSource] = useState<'github' | 'local' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile>('mobile')
  const [pageId, setPageId] = useState<PageId | 'all'>('all')
  const [metricId, setMetricId] = useState<MetricId>('lcp')

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const result = await loadMetricsFile()
      setData(result.data)
      setSource(result.source)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení metrik selhalo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const pages = data?.pages?.length ? data.pages : PAGES
  const windowRange = lastDaysWindow()
  const weekRuns = useMemo(
    () => runsInWindow(data?.runs ?? [], windowRange.from, windowRange.to),
    [data, windowRange.from, windowRange.to],
  )
  const visibleRuns = useMemo(
    () => filterRuns(weekRuns, pageId, profile),
    [pageId, profile, weekRuns],
  )
  const lastUpdate = latestGeneratedAt(data?.runs ?? []) ?? data?.generatedAt
  const failures = failedRuns(visibleRuns)
  const metric = getMetric(metricId)

  return (
    <div className="studio">
      <header className="masthead">
        <p className="eyebrow">KOH-I-NOOR HARDTMUTH · eshop.koh-i-noor.cz</p>
        <div className="masthead-row">
          <h1>Rychlost webu v milimetrech grafitu</h1>
          <button type="button" className="refresh" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Načítám' : 'Obnovit data'}
          </button>
        </div>
        <p className="lede">
          Lighthouse měří homepage, kategorii, produkt a prázdný košík každých 30 minut.
          Mobil i desktop, posledních 7 dní. Skóre se zapisuje do tabulky a kreslí se jako
          souvislá čára na rýsovacím papíře.
        </p>
        <dl className="status-line">
          <div>
            <dt>Poslední měření</dt>
            <dd>{lastUpdate ? `${formatDateTime(lastUpdate)} (${formatRelative(lastUpdate)})` : 'ještě neproběhlo'}</dd>
          </div>
          <div>
            <dt>Zdroj dat</dt>
            <dd>{source === 'github' ? 'živý JSON z GitHubu' : source === 'local' ? 'lokální snapshot' : '—'}</dd>
          </div>
          <div>
            <dt>Chyby v pohledu</dt>
            <dd>{failures.length ? `${failures.length} neúspěšných běhů` : 'žádné'}</dd>
          </div>
        </dl>
        {error && <p className="banner error">{error}</p>}
        {!error && !loading && weekRuns.length === 0 && (
          <p className="banner">
            Tužka je nabroušená. První body se objeví po běhu GitHub Actions, nebo po
            `npm run measure`.
          </p>
        )}
      </header>

      <PagePans
        pages={pages}
        runs={weekRuns}
        profile={profile}
        selectedPageId={pageId}
        onSelect={setPageId}
      />

      <section className="board">
        <Filters
          profile={profile}
          metricId={metricId}
          onProfile={setProfile}
          onMetric={setMetricId}
        />
        <p className="board-note">
          {pageId === 'all' ? 'Všechny čtyři stránky' : pages.find((page) => page.id === pageId)?.label} · {profile === 'mobile' ? 'mobil' : 'desktop'} · {metric.label}
        </p>
        <MetricChart
          runs={visibleRuns}
          metricId={metricId}
          from={windowRange.from}
          to={windowRange.to}
        />
      </section>

      <RunsTable runs={visibleRuns} pages={pages} />

      <footer className="colophon">
        <p>
          Veřejná data obsahují jen naměřené technické hodnoty a už známé URL. Cookies,
          HTML ani přihlášení se neukládají. GitHub cron může začít o pár minut později,
          v datech je skutečný čas měření.
        </p>
      </footer>
    </div>
  )
}

export default App
