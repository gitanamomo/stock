import { useDashboard } from '../context/DashboardContext'

function formatPrice(value: number, code: string): string {
  if (value === 0) return '—'
  if (code === 'XAU') return value.toFixed(2)
  if (code === 'XAG') return value.toFixed(2)
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function MarketOverview() {
  const { indices, loadState } = useDashboard()

  if (loadState === 'loading' || loadState === 'idle') {
    return <MarketOverviewSkeleton />
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {indices.map(item => {
        const isUp = item.changePercent >= 0
        const stale = item._stale
        return (
          <div
            key={item.code}
            className={`bg-white dark:bg-[#1c1c1e] rounded-xl px-4 py-3.5
                       border border-[#e5e5ea] dark:border-[#2c2c2e]
                       hover:shadow-md transition-shadow duration-200
                       ${stale ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs text-[#86868b] dark:text-[#98989d] tracking-wide">
                {item.name}
              </span>
              {stale && (
                <span className="text-[10px] text-[#ff9500] bg-[#fff3e0] dark:bg-[#3a2a10] px-1 rounded">
                  过期
                </span>
              )}
            </div>
            <div className="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums tracking-tight">
              {formatPrice(item.price, item.code)}
            </div>
            <div className={`text-sm mt-1 font-medium tabular-nums ${
              isUp ? 'text-up' : 'text-down'
            }`}>
              {isUp ? '+' : ''}{item.changePercent.toFixed(2)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function MarketOverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-[#1c1c1e] rounded-xl px-4 py-3.5
                                 border border-[#e5e5ea] dark:border-[#2c2c2e]">
          <div className="skeleton h-3 w-16 mb-3" />
          <div className="skeleton h-5 w-24 mb-2" />
          <div className="skeleton h-4 w-14" />
        </div>
      ))}
    </div>
  )
}
