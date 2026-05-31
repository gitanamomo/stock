import { useDashboard } from '../context/DashboardContext'
import type { NewsItem } from '../types'

const sentimentBadge: Record<string, string> = {
  positive: 'text-up bg-up-muted',
  negative: 'text-down bg-down-muted',
  neutral:  'text-[#86868b] bg-gray-100 dark:bg-[#2c2c2e]',
}

const sentimentText: Record<string, string> = {
  positive: '利好',
  negative: '利空',
  neutral:  '中性',
}

// ---------------------------------------------------------------------------
// Single news card
// ---------------------------------------------------------------------------

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="px-5 py-4 hover:bg-[#fafafa] dark:hover:bg-[#222225] transition-colors">
      {/* Meta row */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sentimentBadge[item.sentiment]}`}>
          {sentimentText[item.sentiment]}
        </span>
        <span className="text-xs text-[#86868b] dark:text-[#98989d]">{item.source}</span>
        <span className="text-xs text-[#c7c7cc] dark:text-[#48484a]">{item.publishDate}</span>

        {/* Anti-hallucination warning badge */}
        {item.needsReview && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                           bg-[#fff3e0] dark:bg-[#3a2a10] text-[#e67e00]">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L15 14H1L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="12" r="0.75" fill="currentColor"/>
            </svg>
            待人工核验
          </span>
        )}
      </div>

      {/* Title – clickable if we have a real URL */}
      {item.directUrl && item.directUrl !== '#' ? (
        <a
          href={item.directUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5 leading-snug
                     hover:text-accent transition-colors block"
        >
          {item.title}
        </a>
      ) : (
        <h4 className="text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5 leading-snug">
          {item.title}
        </h4>
      )}

      <p className="text-xs text-[#86868b] dark:text-[#98989d] leading-relaxed line-clamp-2">
        {item.summary}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function AINewsPanel() {
  const { selectedCode, selectedNews, loadState } = useDashboard()

  if (loadState === 'loading' || loadState === 'idle') {
    return <AINewsPanelSkeleton />
  }

  if (!selectedCode) {
    return (
      <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-[#e5e5ea] dark:border-[#2c2c2e]
                      px-8 py-12 text-center">
        <div className="text-[#86868b] dark:text-[#98989d] text-sm">
          点击持仓表格中的任意资产，查看 AI 新闻透视分析
        </div>
      </div>
    )
  }

  if (selectedNews.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-[#e5e5ea] dark:border-[#2c2c2e]
                      px-8 py-12 text-center space-y-2">
        <div className="text-[#86868b] dark:text-[#98989d] text-sm">
          当前资产暂无 AI 新闻数据
        </div>
        <div className="text-xs text-[#c7c7cc] dark:text-[#48484a]">
          请运行 AI 舆情分析管道填充基本面数据
        </div>
      </div>
    )
  }

  // Count warnings
  const warningCount = selectedNews.filter(n => n.needsReview).length

  return (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-[#e5e5ea] dark:border-[#2c2c2e] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#e5e5ea] dark:border-[#2c2c2e] flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
          AI 新闻透视 · {selectedCode}
        </h3>
        {warningCount > 0 && (
          <span className="text-xs text-[#e67e00] font-medium">
            {warningCount} 条待核验
          </span>
        )}
      </div>
      <div className="divide-y divide-[#f0f0f3] dark:divide-[#2c2c2e]">
        {selectedNews.map(item => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function AINewsPanelSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-[#e5e5ea] dark:border-[#2c2c2e] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#e5e5ea] dark:border-[#2c2c2e]">
        <div className="skeleton h-4 w-48" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-5 py-4 space-y-3 border-b border-[#f0f0f3] dark:border-[#2c2c2e]">
          <div className="flex gap-3">
            <div className="skeleton h-5 w-10 rounded-full" />
            <div className="skeleton h-4 w-16" />
            <div className="skeleton h-4 w-12" />
          </div>
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-3 w-3/4" />
        </div>
      ))}
    </div>
  )
}
