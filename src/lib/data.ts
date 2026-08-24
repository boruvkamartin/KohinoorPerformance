import type { MetricsFile } from './types'

const GITHUB_RAW =
  'https://raw.githubusercontent.com/boruvkamartin/KohinoorPerformance/main/public/data/metrics.json'
const LOCAL_PATH = '/data/metrics.json'

type LoadResult = {
  data: MetricsFile
  source: 'github' | 'local'
}

function isMetricsFile(value: unknown): value is MetricsFile {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<MetricsFile>
  return Array.isArray(record.pages) && Array.isArray(record.runs)
}

async function fetchMetrics(url: string): Promise<MetricsFile> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const payload: unknown = await response.json()
  if (!isMetricsFile(payload)) {
    throw new Error('Neplatný formát souboru metrik')
  }
  return payload
}

export async function loadMetricsFile(): Promise<LoadResult> {
  const bust = Date.now()
  const candidates: LoadResult['source'][] = import.meta.env.DEV
    ? ['local']
    : ['github', 'local']
  const errors: string[] = []

  for (const source of candidates) {
    const url =
      source === 'github' ? `${GITHUB_RAW}?t=${bust}` : `${LOCAL_PATH}?t=${bust}`
    try {
      const data = await fetchMetrics(url)
      return { data, source }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${source}: ${message}`)
    }
  }

  throw new Error(`Nepodařilo se načíst metriky (${errors.join('; ')}).`)
}
