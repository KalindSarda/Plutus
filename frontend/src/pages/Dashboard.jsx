import { useState, useEffect, useCallback } from 'react'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { reportService } from '../services/reportService'
import api from '../services/api'
import { aiService } from '../services/aiService'
import { formatINR } from '../utils/currency'
import { formatMonth } from '../utils/dateUtils'

const SLICE_COLORS = [
  '#6b9df5', '#9b74d9', '#f0a429', '#30c4d8',
  '#e87d3e', '#d468a4', '#5abf8a', '#8098c4', '#5a7a6a',
]

const INCOME_COLOR  = '#3dd68c'
const EXPENSE_COLOR = '#f26d6d'

export default function Dashboard() {
  const { user, logout } = useAuth()

  // Current viewing period
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-based

  const [summary, setSummary]       = useState(null)
  const [creditCards, setCreditCards] = useState([])
  const [loading, setLoading]       = useState(true)
  const [aiInsight, setAiInsight]   = useState(null)
  const [aiLoading, setAiLoading]   = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryData, ccRes] = await Promise.allSettled([
        reportService.summary(year, month),
        api.get('/api/credit-cards'),
      ])
      setSummary(summaryData.status === 'fulfilled' ? summaryData.value : null)
      setCreditCards(
        ccRes.status === 'fulfilled' ? (ccRes.value.data ?? []) : []
      )
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Period navigation helpers
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    const nowYear  = today.getFullYear()
    const nowMonth = today.getMonth() + 1
    if (year > nowYear || (year === nowYear && month >= nowMonth)) return // don't go into future
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === today.getFullYear() && month === (today.getMonth() + 1)

  // Derived values (safe defaults when summary is null)
  const totalBalance  = summary?.total_balance  ?? 0
  const totalIncome   = summary?.total_income   ?? 0
  const totalExpense  = summary?.total_expense  ?? 0
  const netSavings    = summary?.net_savings    ?? 0
  const topCategories = summary?.top_categories ?? []
  const expenseSlices = topCategories.filter(c => c.type === 'expense')

  const barData = [{ name: 'This Month', income: totalIncome, expense: totalExpense }]

  const periodLabel = formatMonth(new Date(year, month - 1, 1))

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <div>
          <p style={styles.greeting}>Good {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}</p>
          <h1 style={styles.pageTitle}>Dashboard</h1>
        </div>
        <button onClick={logout} style={styles.logoutBtn} title="Sign out">
          Sign out
        </button>
      </header>

      {/* Period row with nav arrows */}
      <div style={styles.periodRow}>
        <button onClick={prevMonth} style={styles.navBtn} aria-label="Previous month">&#8249;</button>
        <p style={styles.period}>{periodLabel}</p>
        <button
          onClick={nextMonth}
          style={{ ...styles.navBtn, opacity: isCurrentMonth ? 0.3 : 1, cursor: isCurrentMonth ? 'default' : 'pointer' }}
          aria-label="Next month"
          disabled={isCurrentMonth}
        >&#8250;</button>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Loading…</div>
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div style={styles.cardsGrid}>
            <SummaryCard
              label="Total Balance"
              value={summary ? formatINR(totalBalance) : '—'}
              valueStyle={styles.heroNumber}
              sub="across all accounts"
            />
            <SummaryCard
              label="Income"
              value={summary ? formatINR(totalIncome) : '—'}
              valueStyle={{ fontSize: 22, fontFamily: 'Inter, sans-serif', color: '#3dd68c', fontWeight: 500 }}
              sub="this month"
            />
            <SummaryCard
              label="Expenses"
              value={summary ? formatINR(totalExpense) : '—'}
              valueStyle={{ fontSize: 22, fontFamily: 'Inter, sans-serif', color: '#f26d6d', fontWeight: 500 }}
              sub="this month"
            />
            <SummaryCard
              label="Net Savings"
              value={summary ? formatINR(netSavings) : '—'}
              valueStyle={styles.heroNumber}
              sub={summary && totalIncome === 0 ? 'No income recorded yet' : 'this month'}
            />
          </div>

          {/* ── Charts row ── */}
          <div style={styles.chartsRow}>
            {/* Donut chart */}
            <div style={styles.chartCard}>
              <h2 style={styles.sectionTitle}>Expenses by Category</h2>
              {expenseSlices.length === 0 ? (
                <p style={styles.emptyNote}>No expense data for this period.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={expenseSlices}
                        dataKey="amount"
                        nameKey="category_name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        label={false}
                      >
                        {expenseSlices.map((_, i) => (
                          <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Legend */}
                  <div style={styles.legend}>
                    {expenseSlices.map((cat, i) => (
                      <div key={cat.category_name} style={styles.legendRow}>
                        <span
                          style={{
                            ...styles.legendDot,
                            backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length],
                          }}
                        />
                        <span style={styles.legendName}>{cat.category_name}</span>
                        <span style={styles.legendAmount}>{formatINR(cat.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Bar chart */}
            <div style={styles.chartCard}>
              <h2 style={styles.sectionTitle}>Income vs Expenses</h2>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} barCategoryGap="40%" barGap={4}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      color: 'var(--color-text-primary)',
                      fontSize: 13,
                    }}
                    formatter={(value, name) => [formatINR(value), name === 'income' ? 'Income' : 'Expenses']}
                  />
                  <Bar dataKey="income"  fill={INCOME_COLOR}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {/* Manual legend */}
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: 12 }}>
                <div style={styles.legendRow}>
                  <span style={{ ...styles.legendDot, backgroundColor: INCOME_COLOR }} />
                  <span style={styles.legendName}>Income</span>
                  <span style={styles.legendAmount}>{formatINR(totalIncome)}</span>
                </div>
                <div style={styles.legendRow}>
                  <span style={{ ...styles.legendDot, backgroundColor: EXPENSE_COLOR }} />
                  <span style={styles.legendName}>Expenses</span>
                  <span style={styles.legendAmount}>{formatINR(totalExpense)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Plutus AI Insight ── */}
          <section style={{ ...styles.section, marginBottom: '2rem' }}>
            <h2 style={styles.sectionTitle}>Plutus AI</h2>
            <div style={{ ...styles.card, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>✦</span>
              <div style={{ flex: 1 }}>
                {aiInsight ? (
                  <p style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {aiInsight}
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    Ask Plutus about your spending patterns, budget status, or financial health.
                  </p>
                )}
              </div>
              <button
                onClick={async () => {
                  setAiLoading(true)
                  try {
                    const resp = await aiService.chat('Give me a brief financial health summary for this month — key numbers only, 2-3 sentences.')
                    setAiInsight(resp)
                  } catch {
                    setAiInsight('Unable to fetch insight right now.')
                  } finally {
                    setAiLoading(false)
                  }
                }}
                disabled={aiLoading}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-gold)',
                  color: 'var(--color-gold)',
                  borderRadius: 8,
                  padding: '0.45rem 0.875rem',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  opacity: aiLoading ? 0.6 : 1,
                }}
              >
                {aiLoading ? '…' : aiInsight ? 'Refresh' : 'Get insight'}
              </button>
            </div>
          </section>

          {/* ── Credit Cards ── */}
          {creditCards.length > 0 && (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Credit Cards</h2>
              <div style={styles.ccList}>
                {creditCards.map((cc) => (
                  <div key={cc.id} style={styles.ccCard}>
                    <div style={styles.ccTop}>
                      <div>
                        <p style={styles.ccName}>{cc.name}</p>
                        <p style={styles.ccBank}>{cc.bank} Bank</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={styles.ccAvailLabel}>Available</p>
                        <p style={styles.heroNumber}>{formatINR(cc.limit - cc.outstanding)}</p>
                      </div>
                    </div>
                    <div style={styles.ccBar}>
                      <div
                        style={{
                          ...styles.ccBarFill,
                          width: `${Math.min((cc.outstanding / cc.limit) * 100, 100)}%`,
                          backgroundColor: getBarColor(cc.outstanding / cc.limit),
                        }}
                      />
                    </div>
                    <div style={styles.ccFooter}>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                        Outstanding: {formatINR(cc.outstanding)}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                        Limit: {formatINR(cc.limit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────

function SummaryCard({ label, value, valueStyle, sub }) {
  return (
    <div style={styles.card}>
      <p style={styles.cardLabel}>{label}</p>
      <p style={valueStyle}>{value}</p>
      <p style={styles.cardSub}>{sub}</p>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function getBarColor(ratio) {
  if (ratio >= 0.9) return '#f26d6d'
  if (ratio >= 0.7) return '#f0a429'
  return '#3dd68c'
}

// ── Styles ─────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100dvh',
    backgroundColor: 'var(--color-base)',
    padding: '1.5rem',
    maxWidth: 900,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    marginBottom: 2,
  },
  pageTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 24,
    fontWeight: 400,
    color: 'var(--color-text-primary)',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    padding: '0.4rem 0.875rem',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    minHeight: 36,
  },
  periodRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: '1.5rem',
  },
  period: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    margin: 0,
    minWidth: 120,
    textAlign: 'center',
  },
  navBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    fontSize: 20,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  loadingBox: {
    textAlign: 'center',
    padding: '3rem 0',
    color: 'var(--color-text-muted)',
    fontSize: 14,
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '0.875rem',
    marginBottom: '2rem',
  },
  card: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.125rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardLabel: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  heroNumber: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 24,
    fontWeight: 500,
    color: 'var(--color-gold)',
  },
  cardSub: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '0.875rem',
    marginBottom: '2rem',
  },
  chartCard: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.125rem',
  },
  emptyNote: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    textAlign: 'center',
    padding: '2rem 0',
  },
  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 12,
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendName: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  legendAmount: {
    fontSize: 12,
    color: 'var(--color-text-primary)',
    fontWeight: 500,
    flexShrink: 0,
  },
  section: { marginBottom: '2rem' },
  sectionTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 18,
    fontWeight: 400,
    color: 'var(--color-text-primary)',
    marginBottom: '0.875rem',
  },
  ccList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  ccCard: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.125rem',
  },
  ccTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
  },
  ccName: {
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  ccBank: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
  },
  ccAvailLabel: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    textAlign: 'right',
    marginBottom: 2,
  },
  ccBar: {
    height: 4,
    backgroundColor: 'var(--color-border)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  ccBarFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  ccFooter: {
    display: 'flex',
    justifyContent: 'space-between',
  },
}
