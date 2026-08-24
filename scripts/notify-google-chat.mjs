import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildChatMessage,
  diffAlerts,
  evaluateAlerts,
  nextAlertState,
} from './evaluate-alerts.mjs'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_METRICS = join(rootDir, 'public', 'data', 'metrics.json')
const DEFAULT_STATE = join(rootDir, 'public', 'data', 'alert-state.json')
const CONFIG_PATH = join(rootDir, 'src', 'config', 'alerts.json')

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    metricsPath: process.env.METRICS_PATH || DEFAULT_METRICS,
    statePath: process.env.ALERT_STATE_PATH || DEFAULT_STATE,
  }
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    if (fallback !== undefined && error && error.code === 'ENOENT') return fallback
    throw error
  }
}

async function writeJsonAtomic(path, data) {
  const { mkdir, writeFile, rename } = await import('node:fs/promises')
  await mkdir(dirname(path), { recursive: true })
  const tempPath = `${path}.${process.pid}.tmp`
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await rename(tempPath, path)
}

async function postGoogleChat(webhookUrl, text) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google Chat HTTP ${response.status}: ${body.slice(0, 280)}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL
  const config = readJson(CONFIG_PATH)
  const metrics = readJson(options.metricsPath, { pages: [], runs: [] })
  const previous = readJson(options.statePath, { version: 1, open: {} })
  const current = evaluateAlerts(metrics.runs ?? [], config, metrics.pages ?? [])
  const { opened, resolved } = diffAlerts(current, previous.open ?? {})

  if (!opened.length && !resolved.length) {
    console.log('Žádné nové alerty.')
    return
  }

  const text = buildChatMessage({
    opened,
    resolved,
    consecutive: config.consecutive ?? 2,
    dashboardUrl: config.dashboardUrl,
  })
  console.log(text)

  if (options.dryRun) {
    console.log('Dry-run: zpráva se neposílá.')
    return
  }

  if (!webhookUrl) {
    console.log('Chybí GOOGLE_CHAT_WEBHOOK_URL. Přidejte GitHub secret, nebo ho nastavte v prostředí.')
    return
  }

  await postGoogleChat(webhookUrl, text)
  const next = nextAlertState(current, previous)
  await writeJsonAtomic(options.statePath, next)
  console.log(`Odesláno do Google Chat (${opened.length} nových, ${resolved.length} vyřešených).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
