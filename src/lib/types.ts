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
