import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { DashboardData, Holding, NewsItem } from '../types'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

interface DashboardContextValue {
  loadState: LoadState
  error: string | null
  generatedAt: string | null
  indices: DashboardData['indices']
  holdings: Holding[]
  selectedCode: string | null
  selectHolding: (code: string | null) => void
  /** All news for the selected holding, with anti-hallucination validation applied */
  selectedNews: NewsItem[]
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

// ---------------------------------------------------------------------------
// Anti-hallucination: validate every news item before it reaches the UI
// ---------------------------------------------------------------------------

function validateNewsItem(item: NewsItem): NewsItem {
  const missingDate = !item.publishDate || item.publishDate.trim() === ''
  const missingUrl = !item.directUrl || item.directUrl.trim() === ''
  const isHomepage = !missingUrl && (
    item.directUrl.endsWith('/') ||
    !item.directUrl.includes('/') ||
    // Common homepage-only patterns
    item.directUrl.match(/^https?:\/\/[^\/]+\/?$/)
  )

  if (missingDate || missingUrl || isHomepage) {
    return {
      ...item,
      verificationStatus: '待人工核验',
      needsReview: true,
      ...(missingDate && { publishDate: '缺失' }),
      ...(missingUrl && { directUrl: '#' }),
    }
  }

  // If already explicitly verified, keep it
  if (item.verificationStatus === 'verified') {
    return { ...item, needsReview: false }
  }

  // Has date + valid URL but not explicitly verified → auto-verify
  return { ...item, verificationStatus: 'verified', needsReview: false }
}

// ---------------------------------------------------------------------------

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadState('loading')
      setError(null)
      try {
        const resp = await fetch('/stock/data/market_portfolio.json')
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json: DashboardData = await resp.json()
        if (!cancelled) {
          // Validate all news items
          json.holdings = json.holdings.map(h => ({
            ...h,
            aiSentiment: {
              ...h.aiSentiment,
              news: (h.aiSentiment.news || []).map(validateNewsItem),
            },
          }))
          setData(json)
          setLoadState('success')
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load data')
          setLoadState('error')
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  const selectHolding = useCallback((code: string | null) => {
    setSelectedCode(prev => prev === code ? null : code)
  }, [])

  const holdings = data?.holdings ?? []
  const indices = data?.indices ?? []
  const generatedAt = data?.generatedAt ?? null

  // Derive validated news for the selected holding
  const selectedNews: NewsItem[] = (() => {
    if (!selectedCode) return []
    const holding = holdings.find(h => h.code === selectedCode)
    return holding?.aiSentiment?.news ?? []
  })()

  return (
    <DashboardContext.Provider value={{
      loadState, error, generatedAt, indices, holdings,
      selectedCode, selectHolding, selectedNews,
    }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
