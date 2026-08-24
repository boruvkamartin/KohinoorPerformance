import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CRUX_METRIC_IDS,
  createEmptyCruxFile,
  parseCruxHistory,
  parseCruxRecord,
} from './parse-crux.mjs'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_PATH = join(rootDir, 'public', 'data', 'crux.json')
const TARGETS_PATH = join(rootDir, 'src', 'config', 'targets.json')
const API_RECORD = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord'
const API_HISTORY = 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord'
const METRIC_LIST = Object.values(CRUX_METRIC_IDS)
const ORIGIN = 'https://eshop.koh-i-noor.cz'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

async function writeJsonAtomic(path, data) {
  const { mkdir, writeFile, rename } = await import('node:fs/promises')
  await mkdir(dirname(path), { recursive: true })
  const tempPath = `${path}.${process.pid}.tmp`
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await rename(tempPath, path)
}

async function queryCrux(endpoint, body, apiKey) {
  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok && !payload?.error) {
    throw new Error(`CrUX HTTP ${response.status}`)
  }
  return payload
}

function formFactors() {
  return ['PHONE', 'DESKTOP']
}

async function main() {
  const apiKey = process.env.CRUX_API_KEY
  if (!apiKey) {
    console.log('Chybí CRUX_API_KEY. Přidejte GitHub secret, nebo ho nastavte v prostředí.')
    process.exit(0)
  }

  const targets = readJson(TARGETS_PATH)
  const records = []
  const history = []

  for (const formFactor of [...formFactors(), null]) {
    const body = {
      origin: ORIGIN,
      metrics: METRIC_LIST,
      ...(formFactor ? { formFactor } : {}),
    }
    const factorLabel = formFactor ?? 'ALL'
    process.stdout.write(`CrUX origin / ${factorLabel} … `)
    const payload = await queryCrux(API_RECORD, body, apiKey)
    const parsed = parseCruxRecord(payload, {
      pageId: 'origin',
      url: ORIGIN,
      scope: 'origin',
      formFactor: factorLabel,
    })
    records.push(parsed)
    console.log(parsed.status)
  }

  for (const page of targets.pages) {
    for (const formFactor of formFactors()) {
      process.stdout.write(`CrUX ${page.id} / ${formFactor} … `)
      const payload = await queryCrux(
        API_RECORD,
        { url: page.url, formFactor, metrics: METRIC_LIST },
        apiKey,
      )
      const parsed = parseCruxRecord(payload, {
        pageId: page.id,
        url: page.url,
        scope: 'url',
        formFactor,
      })
      records.push(parsed)
      console.log(parsed.status)
    }
  }

  for (const formFactor of [...formFactors(), null]) {
    const factorLabel = formFactor ?? 'ALL'
    process.stdout.write(`CrUX historie origin / ${factorLabel} … `)
    const payload = await queryCrux(
      API_HISTORY,
      {
        origin: ORIGIN,
        metrics: METRIC_LIST,
        ...(formFactor ? { formFactor } : {}),
      },
      apiKey,
    )
    const parsed = parseCruxHistory(payload, {
      pageId: 'origin',
      url: ORIGIN,
      scope: 'origin',
      formFactor: factorLabel,
    })
    history.push(parsed)
    console.log(parsed.status)
  }

  const file = {
    ...createEmptyCruxFile(ORIGIN),
    generatedAt: new Date().toISOString(),
    records,
    history,
  }

  const outPath = process.env.CRUX_PATH || DEFAULT_PATH
  await writeJsonAtomic(outPath, file)
  console.log(`Zapsáno do ${outPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
