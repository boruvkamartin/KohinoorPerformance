import type { CSSProperties } from 'react'
import type { MetricRun, PageTarget, Profile } from '../lib/types'
import { formatMetricValue, formatRelative, rateValue } from '../lib/metrics'
import { latestRun } from '../lib/series'

type PagePansProps = {
  pages: PageTarget[]
  runs: MetricRun[]
  profile: Profile
  selectedPageId: string
  onSelect: (pageId: PageTarget['id'] | 'all') => void
}

export function PagePans({
  pages,
  runs,
  profile,
  selectedPageId,
  onSelect,
}: PagePansProps) {
  return (
    <section className="pans" aria-label="Poslední skóre stránek">
      <button
        type="button"
        className={`pan ${selectedPageId === 'all' ? 'is-active' : ''}`}
        aria-pressed={selectedPageId === 'all'}
        aria-label="Zobrazit všechny stránky"
        onClick={() => onSelect('all')}
      >
        <span className="pan-lid">Přehled</span>
        <strong className="pan-score pan-score-text">vše</strong>
        <span className="pan-meta">4 URL · {profile}</span>
      </button>
      {pages.map((page) => {
        const run = latestRun(runs, page.id, profile)
        const score = run?.metrics?.performance ?? null
        const rating = rateValue('performance', score)
        const style = { '--pan-rating': `var(--${rating})` } as CSSProperties
        return (
          <button
            key={page.id}
            type="button"
            className={`pan rating-${rating} ${selectedPageId === page.id ? 'is-active' : ''}`}
            style={style}
            aria-pressed={selectedPageId === page.id}
            onClick={() => onSelect(page.id)}
          >
            <span className="pan-lid">{page.label}</span>
            <strong className="pan-score">{formatMetricValue('performance', score)}</strong>
            <span className="pan-meta">
              LCP {formatMetricValue('lcp', run?.metrics?.lcp ?? null)}
              {' · '}
              {run ? formatRelative(run.measuredAt) : 'čeká na první běh'}
            </span>
          </button>
        )
      })}
    </section>
  )
}
