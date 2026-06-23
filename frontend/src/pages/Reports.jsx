import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { reportService } from '../services/reportService'
import { formatINR } from '../utils/currency'
import { formatMonth } from '../utils/dateUtils'

const SLICE_COLORS = [
  '#6b9df5', '#9b74d9', '#f0a429', '#30c4d8', '#e87d3e',
  '#d468a4', '#5abf8a', '#8098c4', '#5a7a6a', '#c8a84b',
]

export default function Reports() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [categories, setCategories] = useState([])
  const [trends, setTrends] = useState([])
  const [netWorth, setNetWorth] = useState(null)
  const [projection, setProjection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [cats, tr, nw, proj] = await Promise.allSettled([
        reportService.categories(year, month),
        reportService.trends(6),
        reportService.netWorth(),
        reportService.projection(),
      ])
      setCategories(cats.status === 'fulfilled' ? cats.value : [])
      setTrends(tr.status === 'fulfilled' ? tr.value : [])
      setNetWorth(nw.status === 'fulfilled' ? nw.value : null)
      setProjection(proj.status === 'fulfilled' ? proj.value : null)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    const nowYear = today.getFullYear()
    const nowMonth = today.getMonth() + 1
    if (year > nowYear || (year === nowYear && month >= nowMonth)) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === today.getFullYear() && month === (today.getMonth() + 1)

  async function handleExport() {
    setExporting(true)
    try { await reportService.exportTransactions() }
    finally { setExporting(false) }
  }

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const incomeCategories = categories.filter(c => c.type === 'income')

  const trendData = trends.map(t => ({
    name: t.month_label,
    income: Number(t.income),
    expense: Number(t.expense),
    savings: Number(t.savings),
  }))

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>Reports</h1>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={styles.exportBtn}
        >
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </button>
      </div>

      {/* Period nav */}
      <div style={styles.periodRow}>
        <button onClick={prevMonth} style={styles.navBtn}>&#8249;</button>
        <span style={styles.period}>{formatMonth(new Date(year, month - 1, 1))}</span>
        <button
          onClick={nextMonth}
          style={{ ...styles.navBtn, opacity: isCurrentMonth ? 0.3 : 1 }}
          disabled={isCurrentMonth}
        >&#8250;</button>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Loading…</div>
      ) : (
        <>
          {/* Net Worth + Projection */}
          <div style={styles.cardsRow}>
            {netWorth && (
              <div style={styles.card}>
                <p style={styles.cardLabel}>Net Worth</p>
                <p style={{ ...styles.heroNumber, color: Number(netWorth.net_worth) >= 0 ? 'var(--color-gold)' : 'var(--color-expense)' }}>
                  {formatINR(netWorth.net_worth)}
                </p>
                <p style={styles.cardSub}>Assets {formatINR(netWorth.total_assets)} − Liabilities {formatINR(netWorth.total_liabilities)}</p>
              </div>
            )}
            {projection && (
              <div style={styles.card}>
                <p style={styles.cardLabel}>Projected Savings (Next Month)</p>
                <p style={{ ...styles.heroNumber, color: Number(projection.projected_savings) >= 0 ? 'var(--color-gold)' : 'var(--color-expense)' }}>
                  {formatINR(projection.projected_savings)}
                </p>
                <p style={styles.cardSub}>
                  Avg income {formatINR(projection.avg_income)} · Avg expense {formatINR(projection.avg_expense)}
                  <br />Based on last {projection.based_on_months} months
                </p>
              </div>
            )}
          </div>

          {/* Monthly Trends */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>6-Month Trends</h2>
            <div style={styles.chartCard}>
              {trendData.length === 0 ? (
                <p style={styles.emptyNote}>No trend data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData} barCategoryGap="30%" barGap={2}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
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
                        fontSize: 12,
                      }}
                      formatter={(value, name) => [
                        formatINR(value),
                        name === 'income' ? 'Income' : name === 'expense' ? 'Expenses' : 'Savings',
                      ]}
                    />
                    <Bar dataKey="income" fill="#3dd68c" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expense" fill="#f26d6d" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="savings" fill="#c8a84b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div style={{ display: 'flex', gap: '1rem', marginTop: 8 }}>
                {[['#3dd68c', 'Income'], ['#f26d6d', 'Expenses'], ['#c8a84b', 'Savings']].map(([color, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div style={styles.chartsRow}>
            <CategoryChart title="Expenses by Category" data={expenseCategories} />
            <CategoryChart title="Income by Category" data={incomeCategories} />
          </div>
        </>
      )}
    </div>
  )
}

function CategoryChart({ title, data }) {
  if (data.length === 0) {
    return (
      <div style={styles.chartCard}>
        <h2 style={styles.sectionTitle}>{title}</h2>
        <p style={styles.emptyNote}>No data for this period.</p>
      </div>
    )
  }

  return (
    <div style={styles.chartCard}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category_name"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            label={false}
          >
            {data.map((entry, i) => (
              <Cell key={entry.category_name} fill={entry.color || SLICE_COLORS[i % SLICE_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
        {data.slice(0, 8).map((cat, i) => (
          <div key={cat.category_name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              backgroundColor: cat.color || SLICE_COLORS[i % SLICE_COLORS.length],
            }} />
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', flex: 1 }}>
              {cat.icon} {cat.category_name}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 500 }}>
              {formatINR(cat.amount)}
            </span>
            {cat.percentage != null && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', minWidth: 36, textAlign: 'right' }}>
                {cat.percentage}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100dvh', backgroundColor: 'var(--color-base)', padding: '1.5rem', maxWidth: 960, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  pageTitle: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 400, color: 'var(--color-text-primary)' },
  exportBtn: {
    backgroundColor: 'transparent',
    border: '1px solid var(--color-gold)',
    color: 'var(--color-gold)',
    borderRadius: 8,
    padding: '0.45rem 1rem',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  periodRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem' },
  period: { fontSize: 13, color: 'var(--color-text-muted)', minWidth: 120, textAlign: 'center' },
  navBtn: { background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  loadingBox: { textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)', fontSize: 14 },
  cardsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem', marginBottom: '2rem' },
  card: { backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 6 },
  cardLabel: { fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' },
  heroNumber: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 500 },
  cardSub: { fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 },
  section: { marginBottom: '2rem' },
  sectionTitle: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 400, color: 'var(--color-text-primary)', marginBottom: '0.875rem' },
  chartCard: { backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1.25rem' },
  chartsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.875rem', marginBottom: '2rem' },
  emptyNote: { fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' },
}
