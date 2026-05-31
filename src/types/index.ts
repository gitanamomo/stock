// ---- Market Indices ----

export interface MarketIndex {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  _stale?: boolean
}

// ---- News (strict anti-hallucination schema) ----

export type VerificationStatus = 'verified' | '待人工核验'

export interface NewsItem {
  id: string
  title: string                    // REQUIRED
  source: string
  publishDate: string              // REQUIRED – YYYY-MM-DD
  directUrl: string                // REQUIRED – direct article link, NOT homepage
  sentiment: 'positive' | 'negative' | 'neutral'
  summary: string
  verificationStatus: VerificationStatus
  /** If true, the frontend will show a warning badge */
  needsReview?: boolean
}

// ---- AI Sentiment Slot ----

export interface AISentiment {
  code: string
  name: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
  sentimentScore: number          // -1.0 ~ +1.0
  confidence: number
  summary: string
  analyzedAt: string | null
  model: string | null
  news: NewsItem[]
}

// ---- Technical Indicators ----

export interface GannLevel {
  line: string
  price: number
  pivot_date: string
  pivot_price: number
  distance_pct: number
}

export interface GannFans {
  adr: number
  support_levels: Array<{
    pivot_date: string
    pivot_price: number
    days_ago: number
    '1x1': number
    '1x2': number
    '2x1': number
  }>
  resistance_levels: Array<{
    pivot_date: string
    pivot_price: number
    days_ago: number
    '1x1': number
    '1x2': number
    '2x1': number
  }>
  active_support: GannLevel | null
  active_resistance: GannLevel | null
}

export interface Indicators {
  ma: Record<string, number>
  macd: { macd: number; signal: number; histogram: number }
  boll: { upper: number; middle: number; lower: number }
  gann: GannFans
}

// ---- Holding (with embedded AI sentiment) ----

export interface Holding {
  code: string
  name: string
  price: number
  changePercent: number
  technicalSignal: string
  recommendation: string
  indicators?: Indicators
  aiSentiment: AISentiment
}

// ---- Top-level JSON document ----

export interface DashboardData {
  generatedAt: string
  generatedBy: string
  indices: MarketIndex[]
  holdings: Holding[]
}
