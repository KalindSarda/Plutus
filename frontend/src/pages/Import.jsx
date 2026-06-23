import { useRef, useState } from 'react'
import api from '../services/api'
import { formatINR } from '../utils/currency'

const MAX_FILE_SIZE = 5 * 1024 * 1024

export default function Import() {
  const fileRef = useRef(null)
  const [rows, setRows] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function handleFilePicked(e) {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are accepted.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File exceeds the 5 MB limit.')
      return
    }

    setError('')
    setRows(null)
    setResult(null)
    setParsing(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/api/import/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setRows(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse CSV.')
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleConfirm() {
    if (!rows) return
    setConfirming(true)
    try {
      const { data } = await api.post('/api/import/confirm', { rows })
      setResult(data)
      setRows(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Import failed.')
    } finally {
      setConfirming(false)
    }
  }

  const validCount = rows ? rows.filter(r => r.valid).length : 0
  const invalidCount = rows ? rows.filter(r => !r.valid).length : 0

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Import Transactions</h1>
      <p style={styles.subtitle}>
        Upload a CSV file with columns: <code style={styles.code}>date, type, amount, category</code>
        <br />Optional: <code style={styles.code}>account, credit_card, notes, tags</code>
      </p>

      {/* Upload area */}
      {!rows && !result && (
        <div style={styles.uploadArea} onClick={() => fileRef.current?.click()}>
          <p style={styles.uploadIcon}>📁</p>
          <p style={styles.uploadText}>Click to select a CSV file</p>
          <p style={styles.uploadHint}>Max 5 MB · UTF-8 encoded</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFilePicked}
          />
          {parsing && <p style={styles.uploadHint}>Parsing…</p>}
        </div>
      )}

      {error && <p style={styles.errorText}>{error}</p>}

      {/* Preview table */}
      {rows && (
        <>
          <div style={styles.previewHeader}>
            <div>
              <span style={{ color: 'var(--color-income)', fontWeight: 500 }}>{validCount} valid</span>
              {invalidCount > 0 && (
                <span style={{ color: 'var(--color-expense)', fontWeight: 500, marginLeft: 12 }}>
                  {invalidCount} with errors
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRows(null)} style={styles.cancelBtn}>Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={confirming || validCount === 0}
                style={{ ...styles.confirmBtn, opacity: validCount === 0 ? 0.5 : 1 }}
              >
                {confirming ? 'Importing…' : `Import ${validCount} rows`}
              </button>
            </div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['#', 'Date', 'Type', 'Amount', 'Category', 'Account / Card', 'Notes', 'Status'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.row_number} style={{ backgroundColor: row.valid ? 'transparent' : 'rgba(242,109,109,0.06)' }}>
                    <td style={styles.td}>{row.row_number}</td>
                    <td style={styles.td}>{row.date}</td>
                    <td style={styles.td}>
                      <span style={{ color: row.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)', fontWeight: 500 }}>
                        {row.type}
                      </span>
                    </td>
                    <td style={styles.td}>{row.amount ? formatINR(row.amount) : row.amount}</td>
                    <td style={styles.td}>{row.category}</td>
                    <td style={styles.td}>{row.account || row.credit_card || '—'}</td>
                    <td style={styles.td}>{row.notes || '—'}</td>
                    <td style={styles.td}>
                      {row.valid ? (
                        <span style={{ color: 'var(--color-income)' }}>✓</span>
                      ) : (
                        <span style={{ color: 'var(--color-expense)', fontSize: 11 }}>
                          {row.errors.join('; ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Result */}
      {result && (
        <div style={styles.resultCard}>
          <p style={styles.resultTitle}>Import complete</p>
          <p style={{ color: 'var(--color-income)', fontSize: 15 }}>
            ✓ {result.inserted} transactions imported
          </p>
          {result.skipped > 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              {result.skipped} rows skipped
            </p>
          )}
          <button onClick={() => setResult(null)} style={{ ...styles.confirmBtn, marginTop: 12 }}>
            Import another file
          </button>
        </div>
      )}

      {/* Template download */}
      {!rows && !result && (
        <div style={styles.templateSection}>
          <p style={styles.templateTitle}>CSV Format</p>
          <pre style={styles.templateCode}>
{`date,type,amount,category,account,credit_card,notes,tags
2024-06-01,expense,450,Food & Dining,HDFC Savings,,Lunch with team,food
2024-06-02,income,85000,Salary,HDFC Savings,,June salary,
2024-06-03,expense,2999,Entertainment,,HDFC CC,Netflix subscription,`}
          </pre>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { minHeight: '100dvh', backgroundColor: 'var(--color-base)', padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
  pageTitle: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 400, color: 'var(--color-text-primary)', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: '2rem', lineHeight: 1.7 },
  code: { fontFamily: 'monospace', backgroundColor: 'var(--color-surface)', padding: '1px 5px', borderRadius: 4, fontSize: 13 },
  uploadArea: {
    border: '2px dashed var(--color-border)',
    borderRadius: 12,
    padding: '3rem',
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: '1rem',
    transition: 'border-color 0.15s',
  },
  uploadIcon: { fontSize: 36, marginBottom: 8 },
  uploadText: { fontSize: 15, color: 'var(--color-text-primary)', marginBottom: 4 },
  uploadHint: { fontSize: 12, color: 'var(--color-text-muted)' },
  errorText: { color: 'var(--color-expense)', fontSize: 14, marginBottom: 12 },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 14 },
  tableWrapper: { overflowX: 'auto', borderRadius: 12, border: '1px solid var(--color-border)', marginBottom: '2rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { backgroundColor: 'var(--color-surface)', padding: '0.75rem 0.875rem', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap' },
  td: { padding: '0.625rem 0.875rem', borderTop: '1px solid var(--color-border)', color: 'var(--color-text-primary)', verticalAlign: 'top' },
  cancelBtn: { background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 8, padding: '0.45rem 1rem', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  confirmBtn: { backgroundColor: 'var(--color-gold)', border: 'none', color: '#080c18', borderRadius: 8, padding: '0.45rem 1.25rem', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  resultCard: { backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '2rem', textAlign: 'center', maxWidth: 400, margin: '0 auto' },
  resultTitle: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 400, color: 'var(--color-text-primary)', marginBottom: 12 },
  templateSection: { marginTop: '2rem' },
  templateTitle: { fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 },
  templateCode: { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', fontSize: 12, color: 'var(--color-text-primary)', overflowX: 'auto', lineHeight: 1.6 },
}
