/**
 * PosMaterialsPage — admin/director-only page for managing the POS material
 * catalog. Items defined here become selectable line items in the promo
 * trade-spend section.
 */

import { useState } from 'react'
import { Plus, Trash2, Edit3, Package } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTable, insertRow, updateRow, deleteRow } from '../../hooks/useTable'
import { Modal } from '../../components/ui/Primitives'
import { fmtCompactCurrency, classNames } from '../../lib/format'

const CATEGORIES = ['Display', 'Signage', 'Cooler', 'Premium', 'Other']

export default function PosMaterialsPage() {
  const { profile, isManager } = useAuth()
  const { rows: items } = useTable('pos_materials')
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)

  if (!isManager) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-card p-8 text-center">
        <p className="text-slate-700 font-semibold">Manager / Director access required</p>
        <p className="text-sm text-slate-500 mt-1">POS materials are managed by sales leadership.</p>
      </div>
    )
  }

  const sorted = [...items].sort((a, b) => {
    if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '')
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600 max-w-2xl">
          Define POS materials available for trade-spend planning. Items added here
          will appear as selectable options when leads add a "POS" line to a promo.
        </div>
        <button onClick={() => setAdding(true)} className="btn btn-primary">
          <Plus size={14} /> Add POS Item
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Item</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Category</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-700">Cost / Unit</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Unit</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Description</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">
                No POS items yet. Click "Add POS Item" to create one.
              </td></tr>
            )}
            {sorted.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">
                  <Package size={14} className="inline-block mr-1.5 text-slate-400 -mt-0.5" />
                  {item.name}
                </td>
                <td className="px-4 py-2 text-slate-600">{item.category || '—'}</td>
                <td className="text-right px-4 py-2 font-mono">{fmtCompactCurrency(item.cost_per_unit)}</td>
                <td className="px-4 py-2 text-slate-500">{item.unit_label || 'each'}</td>
                <td className="px-4 py-2 text-slate-500 text-xs max-w-xs truncate" title={item.description}>{item.description || '—'}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setEditing(item)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                    title="Edit"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete "${item.name}"? This will not affect promos that already reference it.`)) {
                        await deleteRow('pos_materials', item.id, profile)
                      }
                    }}
                    className="p-1 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 ml-1"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || adding) && (
        <PosMaterialEditor
          item={editing}
          onClose={() => { setEditing(null); setAdding(false) }}
          onSave={async (form) => {
            if (editing) {
              await updateRow('pos_materials', editing.id, form, profile)
            } else {
              await insertRow('pos_materials', { ...form, active: true, sort_order: items.length + 1 }, profile)
            }
            setEditing(null); setAdding(false)
          }}
        />
      )}
    </div>
  )
}

function PosMaterialEditor({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || 'Display',
    cost_per_unit: item?.cost_per_unit || 0,
    unit_label: item?.unit_label || 'each',
    description: item?.description || '',
  })

  return (
    <Modal open={true} onClose={onClose} title={item ? 'Edit POS Item' : 'Add POS Item'}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-700">Name</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Case Stacker"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Unit Label</label>
            <input
              className="input"
              value={form.unit_label}
              onChange={(e) => setForm({ ...form, unit_label: e.target.value })}
              placeholder="each / pack / set"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Cost per Unit ($)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={form.cost_per_unit}
            onChange={(e) => setForm({ ...form, cost_per_unit: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Description (optional)</label>
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.name.trim()}
            className={classNames('btn', form.name.trim() ? 'btn-primary' : 'btn-secondary opacity-60 cursor-not-allowed')}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
