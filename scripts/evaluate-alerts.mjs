export function pageLabel(pages, pageId) {
  return pages.find((page) => page.id === pageId)?.label ?? pageId
}

export function profileLabel(profile) {
  return profile === 'mobile' ? 'mobil' : 'desktop'
}

export function findingKey(finding) {
  if (finding.kind === 'error') return `${finding.pageId}|${finding.profile}|error`
  return `${finding.pageId}|${finding.profile}|${finding.metricId}`
}

export function formatAlertValue(unit, value) {
  if (value == null || !Number.isFinite(value)) return '—'
  if (unit === 'score') return Math.round(value).toLocaleString('cs-CZ')
  if (unit === 'cls') {
    return value.toLocaleString('cs-CZ', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
  }
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('cs-CZ', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} s`
  }
  return `${Math.round(value).toLocaleString('cs-CZ')} ms`
}

export function isWorse(value, threshold, higherIsBetter) {
  if (value == null || threshold == null) return false
  if (!Number.isFinite(value) || !Number.isFinite(threshold)) return false
  return higherIsBetter ? value < threshold : value > threshold
}

export function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function relativeThreshold(baseline, metricConfig, jumpRatio) {
  if (!Number.isFinite(baseline) || !Number.isFinite(jumpRatio) || jumpRatio <= 0) return null
  const ratioDelta = Math.abs(baseline) * jumpRatio
  const delta = Math.max(metricConfig.minDelta ?? 0, ratioDelta)
  return metricConfig.higherIsBetter ? baseline - delta : baseline + delta
}

function runsFor(runs, pageId, profile) {
  return runs
    .filter((run) => run.pageId === pageId && run.profile === profile)
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt) || a.id.localeCompare(b.id))
}

function snapshotFinding(finding, pages) {
  return {
    ...finding,
    key: findingKey(finding),
    pageLabel: pageLabel(pages, finding.pageId),
  }
}

export function evaluateAlerts(runs, config, pages) {
  const consecutive = config.consecutive ?? 2
  const baselineRuns = config.baselineRuns ?? 6
  const jumpRatio = config.jumpRatio ?? 0
  const pageIds = [...new Set((pages?.length ? pages : runs).map((item) => item.id ?? item.pageId))]
  const profiles = ['mobile', 'desktop']
  const findings = []

  for (const pageId of pageIds) {
    for (const profile of profiles) {
      const series = runsFor(runs, pageId, profile)
      const recent = series.slice(-consecutive)
      if (recent.length >= consecutive && recent.every((run) => run.status === 'error')) {
        findings.push(
          snapshotFinding(
            {
              kind: 'error',
              pageId,
              profile,
              metricId: null,
              value: null,
              limit: null,
              unit: null,
              reason: 'error',
              streak: consecutive,
              error: recent[recent.length - 1]?.error ?? 'měření selhalo',
            },
            pages ?? [],
          ),
        )
      }

      const metricEntries = Object.entries(config.metrics ?? {})
      for (const [metricId, metricConfig] of metricEntries) {
        const window = recent
        if (window.length < consecutive) continue
        if (!window.every((run) => run.status === 'ok' && run.metrics)) continue

        const values = window.map((run) => run.metrics[metricId])
        if (values.some((value) => value == null || !Number.isFinite(value))) continue

        const absoluteLimit = metricConfig[profile]?.limit
        const absHit = values.every((value) =>
          isWorse(value, absoluteLimit, metricConfig.higherIsBetter),
        )

        const okHistory = series.filter((run) => run.status === 'ok' && run.metrics)
        const prior = okHistory.slice(0, -consecutive)
        const baselineValues = prior
          .map((run) => run.metrics?.[metricId])
          .filter((value) => Number.isFinite(value))
        const baseline =
          baselineValues.length >= baselineRuns
            ? median(baselineValues.slice(-baselineRuns))
            : null
        const jumpLimit = relativeThreshold(baseline, metricConfig, jumpRatio)
        const jumpHit = values.every((value) =>
          isWorse(value, jumpLimit, metricConfig.higherIsBetter),
        )

        if (!absHit && !jumpHit) continue

        findings.push(
          snapshotFinding(
            {
              kind: 'metric',
              pageId,
              profile,
              metricId,
              value: values[values.length - 1],
              limit: absHit ? absoluteLimit : jumpLimit,
              unit: metricConfig.unit,
              label: metricConfig.label,
              reason: absHit ? 'absolute' : 'jump',
              streak: consecutive,
              error: null,
            },
            pages ?? [],
          ),
        )
      }
    }
  }

  return findings.sort((a, b) => a.key.localeCompare(b.key))
}

export function diffAlerts(current, previousOpen = {}) {
  const currentMap = Object.fromEntries(current.map((finding) => [finding.key, finding]))
  const opened = current.filter((finding) => !previousOpen[finding.key])
  const resolved = Object.values(previousOpen).filter((finding) => !currentMap[finding.key])
  return { opened, resolved, currentMap }
}

export function nextAlertState(current, previous, now = new Date().toISOString()) {
  const previousOpen = previous?.open ?? {}
  const open = {}
  for (const finding of current) {
    const prior = previousOpen[finding.key]
    open[finding.key] = {
      ...finding,
      openedAt: prior?.openedAt ?? now,
    }
  }
  return { version: 1, updatedAt: now, open }
}

function formatFindingLine(finding) {
  const where = `${finding.pageLabel} · ${profileLabel(finding.profile)}`
  if (finding.kind === 'error') {
    return `• ${where} · měření selhalo (${finding.error})`
  }
  const value = formatAlertValue(finding.unit, finding.value)
  const limit = formatAlertValue(finding.unit, finding.limit)
  const reason =
    finding.reason === 'jump' ? `skok proti běžnému stavu ${limit}` : `hranice ${limit}`
  return `• ${where} · ${finding.label} *${value}* (${reason})`
}

export function buildChatMessage({ opened, resolved, consecutive, dashboardUrl }) {
  const parts = []
  if (opened.length) {
    parts.push(`*Koh-i-noor: rychlost mimo práh*`)
    parts.push(`Hodnoty držely ${consecutive} měření v řadě:`)
    parts.push('')
    parts.push(...opened.map(formatFindingLine))
    parts.push('')
    parts.push('Jedno měření nestačí — tohle už stojí za kontrolu.')
  }
  if (resolved.length) {
    if (parts.length) parts.push('')
    parts.push('*Koh-i-noor: rychlost zpět v normě*')
    parts.push(...resolved.map((finding) => {
      const where = `${finding.pageLabel} · ${profileLabel(finding.profile)}`
      if (finding.kind === 'error') return `• ${where} · měření zase prochází`
      return `• ${where} · ${finding.label}`
    }))
  }
  if (dashboardUrl) {
    parts.push('')
    parts.push(`<${dashboardUrl}|Otevřít dashboard>`)
  }
  return parts.join('\n')
}
