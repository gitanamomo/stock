import { DashboardProvider, useDashboard } from './context/DashboardContext'
import MarketOverview from './components/MarketOverview'
import PortfolioTable from './components/PortfolioTable'
import AINewsPanel from './components/AINewsPanel'

function Header() {
  const { generatedAt } = useDashboard()
  return (
    <header className="border-b border-[#e5e5ea] dark:border-[#2c2c2e] bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="text-up">
            <rect width="32" height="32" rx="6" fill="currentColor" opacity="0.12" />
            <path d="M8 22L16 6l8 16H8z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
            <line x1="16" y1="11" x2="16" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h1 className="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            金融看板
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#86868b] dark:text-[#98989d]">
          {generatedAt && (
            <span className="hidden sm:inline">
              数据更新于 {generatedAt}
            </span>
          )}
          <span>
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </span>
        </div>
      </div>
      {/* Error banner */}
      <ErrorBanner />
    </header>
  )
}

function ErrorBanner() {
  const { loadState, error } = useDashboard()
  if (loadState !== 'error') return null
  return (
    <div className="bg-[#fff3e0] dark:bg-[#3a2a10] border-b border-[#ffe0b2] dark:border-[#5a3a10] px-6 py-2 text-center">
      <span className="text-xs text-[#e67e00]">
        数据加载失败：{error || '未知错误'}。请检查 public/data/market_portfolio.json 是否存在。
      </span>
    </div>
  )
}

export default function App() {
  return (
    <DashboardProvider>
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000000]">
        <Header />
        <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">
          <section>
            <h2 className="text-xs font-medium text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mb-3">
              宏观大盘
            </h2>
            <MarketOverview />
          </section>

          <section>
            <h2 className="text-xs font-medium text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mb-3">
              持仓分析
            </h2>
            <PortfolioTable />
          </section>

          <section>
            <h2 className="text-xs font-medium text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mb-3">
              AI 新闻透视
            </h2>
            <AINewsPanel />
          </section>

          <footer className="pt-4 pb-8 text-center text-xs text-[#c7c7cc] dark:text-[#48484a]">
            数据仅供参考，不构成投资建议
          </footer>
        </main>
      </div>
    </DashboardProvider>
  )
}
