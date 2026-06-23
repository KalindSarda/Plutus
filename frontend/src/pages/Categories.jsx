import { useState, useEffect } from 'react'
import { categoryService } from '../services/categoryService'

const COLOR_SWATCHES = ['#6b9df5', '#9b74d9', '#f0a429', '#30c4d8', '#e87d3e', '#d468a4']

const EMPTY_FORM = {
  name: '',
  type: 'expense',
  parent_id: '',
  color: COLOR_SWATCHES[0],
  icon: '',
}

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal / inline form state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)

  // Subcategory inline form: { parentId, type }
  const [subFormParent, setSubFormParent] = useState(null)
  const [subForm, setSubForm] = useState({ name: '', color: COLOR_SWATCHES[0], icon: '' })
  const [subLoading, setSubLoading] = useState(false)
  const [subError, setSubError] = useState(null)

  // Edit form state: { id, name, color, icon }
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', color: '', icon: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState(null)

  // Delete confirmation
  const [deleteId, setDeleteId] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function fetchCategories() {
    try {
      setLoading(true)
      setError(null)
      const data = await categoryService.list()
      setCategories(data)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  // Derived: group by type, then separate parents from children
  function groupCategories(type) {
    const ofType = categories.filter((c) => c.type === type)
    const parents = ofType.filter((c) => !c.parent_id)
    return parents.map((parent) => ({
      ...parent,
      subcategories: ofType.filter((c) => c.parent_id === parent.id),
    }))
  }

  const incomeGroups = groupCategories('income')
  const expenseGroups = groupCategories('expense')

  // Top-level parents only (for parent dropdown in add form)
  const parentOptions = categories.filter((c) => !c.parent_id)

  // --- Add Category ---
  function openAddModal() {
    setAddForm(EMPTY_FORM)
    setAddError(null)
    setShowAddModal(true)
  }

  function closeAddModal() {
    setShowAddModal(false)
    setAddError(null)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!addForm.name.trim()) { setAddError('Name is required'); return }
    setAddLoading(true)
    setAddError(null)
    try {
      const payload = {
        name: addForm.name.trim(),
        type: addForm.type,
        color: addForm.color,
        icon: addForm.icon.trim() || null,
      }
      if (addForm.parent_id) payload.parent_id = Number(addForm.parent_id)
      await categoryService.create(payload)
      await fetchCategories()
      closeAddModal()
    } catch (err) {
      setAddError(err?.response?.data?.detail || err.message || 'Failed to create category')
    } finally {
      setAddLoading(false)
    }
  }

  // --- Subcategory inline form ---
  function openSubForm(parent) {
    setSubFormParent(parent)
    setSubForm({ name: '', color: parent.color || COLOR_SWATCHES[0], icon: '' })
    setSubError(null)
  }

  function closeSubForm() {
    setSubFormParent(null)
    setSubError(null)
  }

  async function handleAddSub(e) {
    e.preventDefault()
    if (!subForm.name.trim()) { setSubError('Name is required'); return }
    setSubLoading(true)
    setSubError(null)
    try {
      await categoryService.create({
        name: subForm.name.trim(),
        type: subFormParent.type,
        parent_id: subFormParent.id,
        color: subForm.color,
        icon: subForm.icon.trim() || null,
      })
      await fetchCategories()
      closeSubForm()
    } catch (err) {
      setSubError(err?.response?.data?.detail || err.message || 'Failed to create subcategory')
    } finally {
      setSubLoading(false)
    }
  }

  // --- Edit ---
  function startEdit(cat) {
    setEditId(cat.id)
    setEditForm({ name: cat.name, color: cat.color || COLOR_SWATCHES[0], icon: cat.icon || '' })
    setEditError(null)
  }

  function cancelEdit() {
    setEditId(null)
    setEditError(null)
  }

  async function handleEdit(e, id) {
    e.preventDefault()
    if (!editForm.name.trim()) { setEditError('Name is required'); return }
    setEditLoading(true)
    setEditError(null)
    try {
      await categoryService.update(id, {
        name: editForm.name.trim(),
        color: editForm.color,
        icon: editForm.icon.trim() || null,
      })
      await fetchCategories()
      setEditId(null)
    } catch (err) {
      setEditError(err?.response?.data?.detail || err.message || 'Failed to update category')
    } finally {
      setEditLoading(false)
    }
  }

  // --- Delete ---
  async function handleDelete(id) {
    setDeleteLoading(true)
    try {
      await categoryService.delete(id)
      await fetchCategories()
      setDeleteId(null)
    } catch (err) {
      // Reset so user can retry
      setDeleteId(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  // --- Render helpers ---
  function CategoryRow({ cat, isSubcategory = false }) {
    const isEditing = editId === cat.id
    const isDefault = cat.is_default

    if (isEditing) {
      return (
        <div style={{ ...styles.categoryRow, paddingLeft: isSubcategory ? 36 : 12 }}>
          <form
            onSubmit={(e) => handleEdit(e, cat.id)}
            style={styles.inlineForm}
          >
            <input
              style={styles.input}
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Category name"
              autoFocus
            />
            <SwatchPicker
              value={editForm.color}
              onChange={(c) => setEditForm((f) => ({ ...f, color: c }))}
            />
            <input
              style={{ ...styles.input, width: 64 }}
              value={editForm.icon}
              onChange={(e) => setEditForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="Icon"
            />
            {editError && <span style={styles.errorText}>{editError}</span>}
            <button type="submit" style={styles.goldBtn} disabled={editLoading}>
              {editLoading ? 'Saving…' : 'Save'}
            </button>
            <button type="button" style={styles.ghostBtn} onClick={cancelEdit}>
              Cancel
            </button>
          </form>
        </div>
      )
    }

    return (
      <div
        style={{
          ...styles.categoryRow,
          paddingLeft: isSubcategory ? 36 : 12,
          opacity: isDefault ? 0.55 : 1,
        }}
      >
        {/* Color dot */}
        <span
          style={{
            ...styles.colorDot,
            backgroundColor: cat.color || '#7a91ad',
          }}
        />
        {/* Icon */}
        {cat.icon && (
          <span style={styles.iconEmoji}>{cat.icon}</span>
        )}
        {/* Name */}
        <span style={styles.catName}>{cat.name}</span>
        {/* Default badge */}
        {isDefault && (
          <span style={styles.defaultBadge}>Default</span>
        )}
        {/* Actions — only for non-default */}
        {!isDefault && (
          <div style={styles.rowActions}>
            <button
              style={styles.editBtn}
              onClick={() => startEdit(cat)}
              title="Edit"
            >
              Edit
            </button>
            {deleteId === cat.id ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Delete?
                </span>
                <button
                  style={styles.deleteConfirmBtn}
                  onClick={() => handleDelete(cat.id)}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? '…' : 'Yes'}
                </button>
                <button
                  style={styles.ghostBtn}
                  onClick={() => setDeleteId(null)}
                >
                  No
                </button>
              </>
            ) : (
              <button
                style={styles.deleteBtn}
                onClick={() => setDeleteId(cat.id)}
                title="Delete"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  function TypeSection({ title, groups, accentColor }) {
    return (
      <section style={styles.section}>
        <h2 style={{ ...styles.sectionTitle, color: accentColor }}>{title}</h2>
        <div style={styles.card}>
          {groups.length === 0 && (
            <p style={styles.emptyText}>No {title.toLowerCase()} categories yet.</p>
          )}
          {groups.map((parent, idx) => (
            <div key={parent.id}>
              {idx > 0 && <div style={styles.divider} />}
              {/* Parent row */}
              <CategoryRow cat={parent} />
              {/* Subcategories */}
              {parent.subcategories.map((sub) => (
                <CategoryRow key={sub.id} cat={sub} isSubcategory />
              ))}
              {/* Add subcategory form / button */}
              {subFormParent?.id === parent.id ? (
                <form
                  onSubmit={handleAddSub}
                  style={{ ...styles.inlineForm, paddingLeft: 36, marginTop: 6 }}
                >
                  <input
                    style={styles.input}
                    value={subForm.name}
                    onChange={(e) => setSubForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Subcategory name"
                    autoFocus
                  />
                  <SwatchPicker
                    value={subForm.color}
                    onChange={(c) => setSubForm((f) => ({ ...f, color: c }))}
                  />
                  <input
                    style={{ ...styles.input, width: 64 }}
                    value={subForm.icon}
                    onChange={(e) => setSubForm((f) => ({ ...f, icon: e.target.value }))}
                    placeholder="Icon"
                  />
                  {subError && <span style={styles.errorText}>{subError}</span>}
                  <button type="submit" style={styles.goldBtn} disabled={subLoading}>
                    {subLoading ? 'Adding…' : 'Add'}
                  </button>
                  <button type="button" style={styles.ghostBtn} onClick={closeSubForm}>
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  style={styles.addSubBtn}
                  onClick={() => openSubForm(parent)}
                >
                  + Add Subcategory
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    )
  }

  // --- Main render ---
  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Categories</h1>
          <p style={styles.pageSubtitle}>Manage your income and expense categories</p>
        </div>
        <button style={styles.goldBtn} onClick={openAddModal}>
          + Add Category
        </button>
      </header>

      {/* Loading / Error */}
      {loading && <p style={styles.statusText}>Loading…</p>}
      {error && <p style={styles.errorBanner}>{error}</p>}

      {!loading && !error && (
        <>
          <TypeSection
            title="Income"
            groups={incomeGroups}
            accentColor="var(--color-income)"
          />
          <TypeSection
            title="Expense"
            groups={expenseGroups}
            accentColor="var(--color-expense)"
          />
        </>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div style={styles.modalOverlay} onClick={closeAddModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Add Category</h3>
            <form onSubmit={handleAdd} style={styles.modalForm}>
              {/* Name */}
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Groceries"
                autoFocus
              />

              {/* Type */}
              <label style={styles.label}>Type</label>
              <div style={styles.radioGroup}>
                {['income', 'expense'].map((t) => (
                  <label key={t} style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      checked={addForm.type === t}
                      onChange={() => setAddForm((f) => ({ ...f, type: t, parent_id: '' }))}
                      style={{ accentColor: 'var(--color-gold)' }}
                    />
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </label>
                ))}
              </div>

              {/* Parent (optional) */}
              <label style={styles.label}>Parent Category (optional)</label>
              <select
                style={styles.select}
                value={addForm.parent_id}
                onChange={(e) => setAddForm((f) => ({ ...f, parent_id: e.target.value }))}
              >
                <option value="">— None (top-level) —</option>
                {parentOptions
                  .filter((p) => p.type === addForm.type)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.icon ? `${p.icon} ` : ''}{p.name}
                    </option>
                  ))}
              </select>

              {/* Color */}
              <label style={styles.label}>Color</label>
              <SwatchPicker
                value={addForm.color}
                onChange={(c) => setAddForm((f) => ({ ...f, color: c }))}
              />

              {/* Icon */}
              <label style={styles.label}>Icon (emoji)</label>
              <input
                style={{ ...styles.input, width: 80 }}
                value={addForm.icon}
                onChange={(e) => setAddForm((f) => ({ ...f, icon: e.target.value }))}
                placeholder="🛒"
              />

              {addError && <p style={styles.errorText}>{addError}</p>}

              <div style={styles.modalActions}>
                <button type="submit" style={styles.goldBtn} disabled={addLoading}>
                  {addLoading ? 'Creating…' : 'Create'}
                </button>
                <button type="button" style={styles.ghostBtn} onClick={closeAddModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Reusable swatch picker component
function SwatchPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {COLOR_SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          onClick={() => onChange(swatch)}
          title={swatch}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: swatch,
            border: value === swatch ? '2px solid var(--color-text-primary)' : '2px solid transparent',
            cursor: 'pointer',
            padding: 0,
            outline: value === swatch ? '2px solid var(--color-gold)' : 'none',
            outlineOffset: 2,
          }}
        />
      ))}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100dvh',
    backgroundColor: 'var(--color-base)',
    padding: '1.5rem',
    maxWidth: 860,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.75rem',
  },
  pageTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 24,
    fontWeight: 400,
    color: 'var(--color-text-primary)',
    marginBottom: 2,
  },
  pageSubtitle: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  statusText: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    padding: '2rem 0',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(242,109,109,0.12)',
    border: '1px solid var(--color-expense)',
    borderRadius: 8,
    padding: '0.75rem 1rem',
    color: 'var(--color-expense)',
    fontSize: 14,
    marginBottom: '1.5rem',
  },
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 18,
    fontWeight: 400,
    marginBottom: '0.75rem',
  },
  card: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyText: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    padding: '1rem 1.125rem',
  },
  divider: {
    height: 1,
    backgroundColor: 'var(--color-border)',
  },
  categoryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0.625rem 1rem 0.625rem 12px',
    flexWrap: 'wrap',
    minHeight: 44,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
  },
  iconEmoji: {
    fontSize: 16,
    lineHeight: 1,
  },
  catName: {
    fontSize: 14,
    color: 'var(--color-text-primary)',
    fontWeight: 500,
    flex: 1,
    minWidth: 120,
  },
  defaultBadge: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: '1px 6px',
    fontWeight: 500,
  },
  rowActions: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    marginLeft: 'auto',
  },
  editBtn: {
    background: 'none',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    padding: '0.25rem 0.625rem',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
    minHeight: 28,
  },
  deleteBtn: {
    background: 'transparent',
    border: '1px solid var(--color-expense)',
    color: 'var(--color-expense)',
    borderRadius: 8,
    padding: '0.25rem 0.625rem',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
    minHeight: 28,
  },
  deleteConfirmBtn: {
    background: 'var(--color-expense)',
    border: 'none',
    color: '#fff',
    borderRadius: 8,
    padding: '0.25rem 0.625rem',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
    minHeight: 28,
  },
  addSubBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    fontSize: 12,
    cursor: 'pointer',
    padding: '0.375rem 1rem 0.5rem 36px',
    fontFamily: 'inherit',
    display: 'block',
    width: '100%',
    textAlign: 'left',
  },
  inlineForm: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0.5rem 1rem',
    flexWrap: 'wrap',
    backgroundColor: 'var(--color-surface)',
  },
  goldBtn: {
    backgroundColor: 'var(--color-gold)',
    color: '#080c18',
    border: 'none',
    borderRadius: 8,
    padding: '0.375rem 1rem',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
    fontWeight: 600,
    minHeight: 36,
  },
  ghostBtn: {
    background: 'none',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    padding: '0.375rem 0.875rem',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    minHeight: 36,
  },
  input: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    fontSize: 14,
    fontFamily: 'inherit',
    padding: '0.375rem 0.625rem',
    minHeight: 34,
    outline: 'none',
    flex: 1,
    minWidth: 140,
  },
  select: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    fontSize: 14,
    fontFamily: 'inherit',
    padding: '0.375rem 0.625rem',
    minHeight: 36,
    width: '100%',
    cursor: 'pointer',
  },
  label: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginTop: 8,
    display: 'block',
  },
  radioGroup: {
    display: 'flex',
    gap: 16,
    marginTop: 4,
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
  errorText: {
    fontSize: 12,
    color: 'var(--color-expense)',
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(8,12,24,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '1rem',
  },
  modal: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.5rem',
    width: '100%',
    maxWidth: 420,
    maxHeight: '90dvh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 20,
    fontWeight: 400,
    color: 'var(--color-text-primary)',
    marginBottom: '1rem',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  modalActions: {
    display: 'flex',
    gap: 8,
    marginTop: 16,
  },
}
