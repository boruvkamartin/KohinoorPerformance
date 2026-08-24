import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import lighthouse, { desktopConfig } from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import {
  appendRuns,
  createEmptyMetricsFile,
  createErrorRun,
  createRunId,
  parseLighthouseResult,
} from './parse-lighthouse.mjs'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_METRICS_PATH = join(rootDir, 'public', 'data', 'metrics.json')
const DEFAULT_REPORTS_DIR = join(rootDir, 'artifacts', 'lighthouse')
const TARGETS_PATH = join(rootDir, 'src', 'config', 'targets.json')
const MAX_ATTEMPTS = 3

function parseList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseArgs(argv) {
  const options = {
    pages: parseList(process.env.MEASURE_PAGES),
    profiles: parseList(process.env.MEASURE_PROFILES),
    metricsPath: process.env.METRICS_PATH || DEFAULT_METRICS_PATH,
    reportsDir: process.env.REPORTS_DIR || DEFAULT_REPORTS_DIR,
  }

  for (const arg of argv) {
    if (arg.startsWith('--pages=')) options.pages = parseList(arg.slice(8))
    if (arg.startsWith('--profiles=')) options.profiles = parseList(arg.slice(11))
    if (arg.startsWith('--metrics=')) options.metricsPath = arg.slice(10)
    if (arg.startsWith('--reports=')) options.reportsDir = arg.slice(10)
  }

  return options
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

function chromeFlags() {
  return [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-background-networking',
  ]
}

async function runAudit(url, profile) {
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH || undefined,
    chromeFlags: chromeFlags(),
  })

  try {
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        output: ['html'],
        logLevel: 'error',
        onlyCategories: ['performance'],
      },
      profile === 'desktop' ? desktopConfig : undefined,
    )

    if (!result?.lhr) {
      throw new Error('Lighthouse nevrátil výsledek')
    }

    const report = Array.isArray(result.report) ? result.report[0] : result.report
    return { lhr: result.lhr, html: typeof report === 'string' ? report : null }
  } finally {
    await chrome.kill()
  }
}

async function runWithRetry(url, profile) {
  let lastError
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runAudit(url, profile)
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS) {
        await sleep(4000 * attempt)
      }
    }
  }
  throw lastError
}

function fileSafe(value) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

async function writeReport(reportsDir, runId, html) {
  if (!html) return
  const { mkdir, writeFile } = await import('node:fs/promises')
  await mkdir(reportsDir, { recursive: true })
  const filename = `${fileSafe(runId)}.html`
  await writeFile(join(reportsDir, filename), html, 'utf8')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const targets = readJson(TARGETS_PATH)
  const selectedPages = options.pages.length
    ? targets.pages.filter((page) => options.pages.includes(page.id))
    : targets.pages
  const selectedProfiles = options.profiles.length
    ? targets.profiles.filter((profile) => options.profiles.includes(profile))
    : targets.profiles

  if (!selectedPages.length || !selectedProfiles.length) {
    throw new Error('Žádné stránky nebo profily k měření')
  }

  const existing = readJson(options.metricsPath, createEmptyMetricsFile(targets.pages))
  const collected = []

  for (const page of selectedPages) {
    for (const profile of selectedProfiles) {
      const measuredAt = new Date().toISOString()
      const context = {
        id: createRunId(measuredAt, page.id, profile),
        measuredAt,
        pageId: page.id,
        profile,
        url: page.url,
      }

      process.stdout.write(`Měřím ${page.id} / ${profile} … `)
      try {
        const { lhr, html } = await runWithRetry(page.url, profile)
        const run = parseLighthouseResult(lhr, context)
        collected.push(run)
        await writeReport(options.reportsDir, context.id, html)
        console.log(`OK (${run.metrics.performance ?? '—'})`)
      } catch (error) {
        const run = createErrorRun(context, error)
        collected.push(run)
        console.log(`CHYBA (${run.error})`)
      }

      await sleep(1500)
    }
  }

  const nextFile = appendRuns(
    {
      ...existing,
      pages: targets.pages,
    },
    collected,
  )
  await writeJsonAtomic(options.metricsPath, nextFile)
  console.log(`Zapsáno ${collected.length} běhů do ${options.metricsPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
