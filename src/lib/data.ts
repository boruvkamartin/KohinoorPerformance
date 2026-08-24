import type { CruxFile, MetricsFile } from './types'

const GITHUB_BASE =
  'https://raw.githubusercontent.com/boruvkamartin/KohinoorPerformance/main/public/data'
const LOCAL_BASE = `${import.meta.env.BASE_URL}data`.replace(/\/$/, '')

type LoadResult<T> = {
  data: T
  source: 'github' | 'local'
}

function isMetricsFile(value: unknown): value is MetricsFile {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<MetricsFile>
  return Array.isArray(record.pages) && Array.isArray(record.runs)
}

function isCruxFile(value: unknown): value is CruxFile {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<CruxFile>
  return Array.isArray(record.records) && Array.isArray(record.history)
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

async function loadFile<T>(
  filename: string,
  guard: (value: unknown) => value is T,
  invalidMessage: string,
): Promise<LoadResult<T>> {
  const bust = Date.now()
  const candidates: LoadResult<T>['source'][] = import.meta.env.DEV
    ? ['local']
    : ['github', 'local']
  const errors: string[] = []

  for (const source of candidates) {
    const base = source === 'github' ? GITHUB_BASE : LOCAL_BASE
    try {
      const payload = await fetchJson(`${base}/${filename}?t=${bust}`)
      if (!guard(payload)) {
        throw new Error(invalidMessage)
      }
      return { data: payload, source }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${source}: ${message}`)
    }
  }

  throw new Error(`Nepodařilo se načíst ${filename} (${errors.join('; ')}).`)
}

export async function loadMetricsFile(): Promise<LoadResult<MetricsFile>> {
  return loadFile('metrics.json', isMetricsFile, 'Neplatný formát souboru metrik')
}

export async function loadCruxFile(): Promise<LoadResult<CruxFile>> {
  return loadFile('crux.json', isCruxFile, 'Neplatný formát CrUX souboru')
}
