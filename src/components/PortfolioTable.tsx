import { useDashboard } from '../context/DashboardContext'

const sentimentLabel: Record<string, { text: string; style: string }> = {
  bullish:  { text: '利好', style: 'bg-up-muted text-up' },
  bearish:  { text: '利空', style: 'bg-down-muted text-down' },
  neutral:  { text: '中性', style: 'bg-gray-100 dark:bg-[#2c2c2e] text-[#86868b]' },
}

export default function PortfolioTable() {
  const { holdings, selectedCode, selectHolding, loadState } = useDashboard()

  if (loadState === 'loading' || loadState === 'idle') {
    return <PortfolioTableSkeleton />
  }

  return (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-[#e5e5ea] dark:border-[#2c2c2e] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e5ea] dark:border-[#2c2c2e] text-left">
              <th className="px-5 py-3 text-xs font-medium text-[#86868b] dark:text-[#98989d] tracking-wide uppercase">代码</th>
              <th className="px-5 py-3 text-xs font-medium text-[#86868b] dark:text-[#98989d] tracking-wide uppercase">名称</th>
              <th className="px-5 py-3 text-xs font-medium text-[#86868b] dark:text-[#98989d] tracking-wide uppercase text-right">最新价</th>
              <th className="px-5 py-3 text-xs font-medium text-[#86868b] dark:text-[#98989d] tracking-wide uppercase text-right">涨跌幅</th>
              <th className="px-5 py-3 text-xs font-medium text-[#86868b] dark:text-[#98989d] tracking-wide uppercase">AI 舆情</th>
              <th className="px-5 py-3 text-xs font-medium text-[#86868b] dark:text-[#98989d] tracking-wide uppercase">技术面信号</th>
              <th className="px-5 py-3 text-xs font-medium text-[#86868b] dark:text-[#98989d] tracking-wide uppercase">综合建议</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map(h => {
              const isUp = h.changePercent >= 0
              const s = sentimentLabel[h.aiSentiment?.sentiment ?? 'neutral']
              const isSelected = selectedCode === h.code
              return (
                <tr
                  key={h.code}
                  onClick={() => selectHolding(h.code)}
                  className={`border-b border-[#f0f0f3] dark:border-[#2c2c2e] cursor-pointer
                    transition-colors duration-150
                    ${isSelected
                      ? 'bg-[#f0f4ff] dark:bg-[#1a2236]'
                      : 'hover:bg-[#fafafa] dark:hover:bg-[#222225]'}`}
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-[#86868b] dark:text-[#98989d] tracking-tight">
                    {h.code}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {h.name}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">
                    {h.price === 0 ? '—' : h.price.toFixed(2)}
                  </td>
                  <td className={`px-5 py-3.5 text-right tabular-nums font-medium ${
                    isUp ? 'text-up' : 'text-down'
                  }`}>
                    {isUp ? '+' : ''}{h.changePercent.toFixed(2)}%
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${s.style}`}>
                      {s.text}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#86868b] dark:text-[#98989d] max-w-48 truncate">
                    {h.technicalSignal}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {h.recommendation}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PortfolioTableSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-[#e5e5ea] dark:border-[#2c2c2e] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#e5e5ea] dark:border-[#2c2c2e] flex gap-8">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton h-3 w-16" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-5 py-4 border-b border-[#f0f0f3] dark:border-[#2c2c2e] flex gap-8 items-center">
          <div className="skeleton h-4 w-14" />
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 w-16 ml-auto" />
          <div className="skeleton h-4 w-14" />
          <div className="skeleton h-5 w-12 rounded-full" />
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
