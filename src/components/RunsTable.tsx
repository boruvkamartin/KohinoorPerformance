import type { MetricRun, PageTarget } from '../lib/types'
import { METRICS, formatDateTime, formatMetricValue, rateValue } from '../lib/metrics'

type RunsTableProps = {
  runs: MetricRun[]
  pages: PageTarget[]
}

export function RunsTable({ runs, pages }: RunsTableProps) {
  const labels = Object.fromEntries(pages.map((page) => [page.id, page.label]))
  const rows = [...runs].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))

  return (
    <section className="table-wrap">
      <div className="table-head">
        <h2>Jednotlivé běhy</h2>
        <p>Posledních 7 dní, nejnovější nahoře. Chybějící nebo neúspěšné audity zůstanou v tabulce, graf je přeskočí.</p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Čas</th>
              <th>Stránka</th>
              <th>Profil</th>
              {METRICS.map((metric) => (
                <th key={metric.id}>{metric.shortLabel}</th>
              ))}
              <th>Stav</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11}>Zatím žádné běhy. Spusťte měření nebo počkejte na GitHub Actions.</td>
              </tr>
            ) : (
              rows.map((run) => (
                <tr key={run.id} className={run.status === 'error' ? 'is-error' : ''}>
                  <td>{formatDateTime(run.measuredAt)}</td>
                  <td>{labels[run.pageId] ?? run.pageId}</td>
                  <td>{run.profile === 'mobile' ? 'Mobil' : 'Desktop'}</td>
                  {METRICS.map((metric) => {
                    const value = run.metrics?.[metric.id] ?? null
                    return (
                      <td key={metric.id} className={`rating-${rateValue(metric.id, value)}`}>
                        {formatMetricValue(metric.id, value)}
                      </td>
                    )
                  })}
                  <td>{run.status === 'ok' ? 'OK' : run.error ?? 'Chyba'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
