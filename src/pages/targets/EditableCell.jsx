/**
 * EditableCell — click-to-edit cell with Tab/Enter navigation. Used by both
 * the ForecastGrid and the Targets page so behavior is consistent.
 */

import { useEffect, useRef, useState } from 'react'
import { fmtCell, parseCell } from '../forecast-grid/helpers'

export default function EditableCell({ value, readOnly, onCommit, className }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  if (readOnly) {
    return <div className={`px-1 truncate ${className || ''}`}>{fmtCell(value)}</div>
  }

  function commit() {
    if (draft !== '' && draft !== fmtCell(value)) {
      const parsed = parseCell(draft)
      if (parsed !== null) onCommit(parsed)
    }
    setEditing(false)
    setDraft('')
  }

  function handleKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
      const next = findNextEditable(e.target, 'down')
      next?.focus()
    } else if (e.key === 'Escape') {
      setEditing(false)
      setDraft('')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commit()
      const next = findNextEditable(e.target, e.shiftKey ? 'left' : 'right')
      next?.focus()
    }
  }

  return (
    <button
      onClick={() => {
        setDraft(fmtCell(value))
        setEditing(true)
      }}
      onFocus={() => {
        if (!editing) {
          setDraft(fmtCell(value))
          setEditing(true)
        }
      }}
      className={`block w-full text-right px-1 py-0.5 hover:ring-1 hover:ring-slate-300 hover:bg-slate-50 rounded-sm focus:ring-2 focus:ring-navy-700 focus:outline-none ${className || ''}`}
      tabIndex={0}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          className="w-full text-right bg-white border border-navy-700 rounded-sm px-0.5 outline-none font-mono"
        />
      ) : (
        <span className="truncate">{fmtCell(value)}</span>
      )}
    </button>
  )
}

function findNextEditable(currentEl, direction) {
  const td = currentEl.closest('td')
  if (!td) return null
  let target = td
  if (direction === 'right') target = td.nextElementSibling
  else if (direction === 'left') target = td.previousElementSibling
  else if (direction === 'down') {
    const idx = Array.from(td.parentElement.children).indexOf(td)
    let row = td.parentElement.nextElementSibling
    while (row) {
      const candidate = row.children[idx]?.querySelector('button[tabindex="0"]')
      if (candidate) return candidate
      row = row.nextElementSibling
    }
    return null
  }
  while (target) {
    const btn = target.querySelector('button[tabindex="0"]')
    if (btn) return btn
    target = direction === 'right' ? target.nextElementSibling : target.previousElementSibling
  }
  return null
}
