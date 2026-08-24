import type { MetricId, Profile } from '../lib/types'
import { METRICS } from '../lib/metrics'

type FiltersProps = {
  profile: Profile
  metricId: MetricId
  onProfile: (profile: Profile) => void
  onMetric: (metricId: MetricId) => void
}

export function Filters({ profile, metricId, onProfile, onMetric }: FiltersProps) {
  return (
    <div className="filters">
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
