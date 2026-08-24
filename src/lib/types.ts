export type Profile = 'mobile' | 'desktop'
export type PageId = 'homepage' | 'category' | 'product' | 'basket'
export type MetricId =
  | 'performance'
  | 'fcp'
  | 'lcp'
  | 'si'
  | 'tbt'
  | 'cls'
  | 'ttfb'
export type FieldMetricId = 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb'
export type FormFactor = 'PHONE' | 'DESKTOP' | 'ALL'
export type RunStatus = 'ok' | 'error'
export type Rating = 'good' | 'needs-improvement' | 'poor' | 'unknown'

export type PageTarget = {
  id: PageId
  label: string
  url: string
}

export type MetricValues = {
  performance: number | null
  fcp: number | null
  lcp: number | null
  si: number | null
  tbt: number | null
  cls: number | null
  ttfb: number | null
}

export type MetricRun = {
  id: string
  measuredAt: string
  pageId: PageId
  profile: Profile
  url: string
  status: RunStatus
  error: string | null
  metrics: MetricValues | null
}

export type MetricsFile = {
  version: 1
  generatedAt: string | null
  pages: PageTarget[]
  runs: MetricRun[]
}

export type CruxDistribution = {
  p75: number | null
  good: number | null
  ni: number | null
  poor: number | null
}

export type CruxMetrics = Record<FieldMetricId, CruxDistribution>

export type CruxRecord = {
  pageId: PageId | 'origin'
  url: string
  scope: 'url' | 'origin'
  formFactor: FormFactor
  status: 'ok' | 'insufficient-data' | 'error'
  error: string | null
  collectionPeriod: { firstDate: string; lastDate: string } | null
  metrics: CruxMetrics | null
}

export type CruxHistoryPoint = {
  endDate: string
  firstDate: string | null
  lcp: number | null
  inp: number | null
  cls: number | null
  fcp: number | null
  ttfb: number | null
}

export type CruxHistorySeries = {
  pageId: PageId | 'origin'
  url: string
  scope: 'url' | 'origin'
  formFactor: FormFactor
  status: 'ok' | 'insufficient-data' | 'error'
  error: string | null
  points: CruxHistoryPoint[]
}

export type CruxFile = {
  version: 1
  generatedAt: string | null
  origin: string
  records: CruxRecord[]
  history: CruxHistorySeries[]
}
