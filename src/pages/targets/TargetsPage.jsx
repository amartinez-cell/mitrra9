/**
 * TargetsPage — manager-only target-setting interface.
 * Two tabs: Distributor Targets (the dp_targets master) and Rep Targets
 * (per-rep monthly revenue, simplified to total revenue only).
 */

import { useState } from 'react'
import { Building2, Users } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { classNames } from '../../lib/format'
import DistributorTargetsTab from './DistributorTargetsTab'
import RepTargetsTab from './RepTargetsTab'

export default function TargetsPage() {
  const { isManager } = useAuth()
  const [tab, setTab] = useState('distributors')

  if (!isManager) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-card p-8 text-center">
        <p className="text-slate-700 font-semibold">Manager access required</p>
        <p className="text-sm text-slate-500 mt-1">Target setting is restricted to sales leadership.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 inline-flex">
        <TabButton active={tab === 'distributors'} onClick={() => setTab('distributors')} icon={Building2}>
          Distributor Targets
        </TabButton>
        <TabButton active={tab === 'reps'} onClick={() => setTab('reps')} icon={Users}>
          Rep Targets
        </TabButton>
      </div>

      {tab === 'distributors' && <DistributorTargetsTab />}
      {tab === 'reps'         && <RepTargetsTab />}
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
        active ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      )}
    >
      <Icon size={14} />
      {children}
    </button>
  )
}
