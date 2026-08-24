import type { MetricId, Profile } from '../lib/types'
import { METRICS } from '../lib/metrics'
import { RANGE_DAYS, type RangeDays } from '../lib/series'

type FiltersProps = {
  profile: Profile
  metricId: MetricId
  rangeDays: RangeDays
  onProfile: (profile: Profile) => void
  onMetric: (metricId: MetricId) => void
  onRangeDays: (days: RangeDays) => void
}

function rangeButtonLabel(days: RangeDays) {
  if (days === 1) return '1 den'
  if (days < 5) return `${days} dny`
  return `${days} dní`
}

export function Filters({
  profile,
  metricId,
  rangeDays,
  onProfile,
  onMetric,
  onRangeDays,
}: FiltersProps) {
  return (
    <div className="filters">
      <fieldset>
        <legend>Období</legend>
        <div className="segment">
          {RANGE_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              className={rangeDays === days ? 'is-active' : ''}
              aria-pressed={rangeDays === days}
              onClick={() => onRangeDays(days)}
            >
              {rangeButtonLabel(days)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Profil</legend>
        <div className="segment">
          {(['mobile', 'desktop'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={profile === item ? 'is-active' : ''}
              aria-pressed={profile === item}
              onClick={() => onProfile(item)}
            >
              {item === 'mobile' ? 'Mobil' : 'Desktop'}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Metrika</legend>
        <div className="metric-row">
          {METRICS.map((metric) => (
            <button
              key={metric.id}
              type="button"
              className={metricId === metric.id ? 'is-active' : ''}
              aria-pressed={metricId === metric.id}
              onClick={() => onMetric(metric.id)}
              title={metric.description}
            >
              {metric.shortLabel}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
