function sanitizeCell(value) {
  const s = String(value ?? '')
  if (s && ['=', '-', '+', '@', '\t', '\r'].includes(s[0])) return "'" + s
  return s
}

export function downloadCSV(rows, filename = 'export.csv') {
  if (!rows || rows.length === 0) return

  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(sanitizeCell).join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = sanitizeCell(row[h])
        // Quote fields containing commas, quotes, or newlines
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return '"' + val.replace(/"/g, '""') + '"'
        }
        return val
      }).join(',')
    ),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
