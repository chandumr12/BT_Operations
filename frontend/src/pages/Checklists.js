import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { CheckSquare, ListChecks, Clock, CheckCircle2 } from 'lucide-react';

const BRAND = '#f1563f';

const Checklists = () => {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchBatches(); }, []);

  useEffect(() => {
    if (selectedBatchId) fetchChecklists(selectedBatchId);
  }, [selectedBatchId]);

  const fetchBatches = async () => {
    try {
      const response = await api.get('/batches');
      setBatches(response.data);
    } catch {
      toast.error('Failed to fetch batches');
    }
  };

  const fetchChecklists = async (batchId) => {
    setLoading(true);
    try {
      const response = await api.get(`/checklists/${batchId}`);
      if (response.data.length === 0) {
        await createDefaultChecklists(batchId);
        const newResponse = await api.get(`/checklists/${batchId}`);
        setChecklists(newResponse.data);
      } else {
        setChecklists(response.data);
      }
    } catch {
      toast.error('Failed to fetch checklists');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultChecklists = async (batchId) => {
    const defaultChecklists = [
      {
        batchId, type: 'pre',
        items: [
          { task: 'Transport confirmed',         status: 'pending', assignedTo: '' },
          { task: 'Stay confirmed',              status: 'pending', assignedTo: '' },
          { task: 'Forest permits confirmed',    status: 'pending', assignedTo: '' },
          { task: 'Participant list finalized',  status: 'pending', assignedTo: '' },
          { task: 'Medical kit assigned',        status: 'pending', assignedTo: '' },
          { task: 'ID cards printed',            status: 'pending', assignedTo: '' },
          { task: 'Badges packed',               status: 'pending', assignedTo: '' },
        ],
      },
      {
        batchId, type: 'during',
        items: [
          { task: 'Attendance marked',                 status: 'pending', assignedTo: '' },
          { task: 'Emergency contact list shared',     status: 'pending', assignedTo: '' },
          { task: 'Photos uploaded',                   status: 'pending', assignedTo: '' },
        ],
      },
      {
        batchId, type: 'post',
        items: [
          { task: 'Expense sheet submitted',           status: 'pending', assignedTo: '' },
          { task: 'Feedback collected',                status: 'pending', assignedTo: '' },
          { task: 'Lost & found checked',              status: 'pending', assignedTo: '' },
        ],
      },
    ];
    await Promise.all(defaultChecklists.map(cl => api.post('/checklists', cl)));
  };

  const toggleItemStatus = async (checklistId, itemIndex, currentStatus) => {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done';
    try {
      await api.patch(`/checklists/${checklistId}/items/${itemIndex}`, { status: newStatus });
      setChecklists(prev => prev.map(cl => {
        if (cl.id !== checklistId) return cl;
        const items = [...cl.items];
        items[itemIndex] = { ...items[itemIndex], status: newStatus };
        return { ...cl, items };
      }));
    } catch {
      toast.error('Failed to update task');
    }
  };

  const getChecklistTitle = (type) => {
    const titles = { pre: 'Pre-Trek', during: 'During Trek', post: 'Post-Trek' };
    return titles[type] || 'Checklist';
  };

  const getChecklistIcon = (type) => {
    const icons = { pre: Clock, during: CheckSquare, post: ListChecks };
    return icons[type] || CheckSquare;
  };

  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  return (
    <div data-testid="checklists-page" className="space-y-5">

      {/* Page header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black heading-font text-slate-900">Checklists</h1>
        <p className="text-slate-400 text-sm mt-0.5">Pre, during, and post-trek task tracking</p>
      </div>

      {/* Batch selector card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
        <Label className="text-slate-600 font-semibold text-xs uppercase tracking-widest mb-2.5 block">
          Select Batch
        </Label>
        <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
          <SelectTrigger data-testid="batch-selector"
            className="bg-slate-50 border-slate-200 h-11 rounded-xl text-sm font-medium"
            style={{ '--ring-color': BRAND }}>
            <SelectValue placeholder="Choose a batch to view checklists…" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {batches.map(batch => (
              <SelectItem key={batch.id} value={batch.id}>
                {batch.batchCode} — {new Date(batch.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedBatch && (
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl border"
            style={{ borderColor: `${BRAND}30`, background: `${BRAND}07` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: BRAND }}>
              <CheckSquare size={16} color="#fff" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{selectedBatch.batchCode}</p>
              <p className="text-xs text-slate-500">
                {new Date(selectedBatch.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
                {new Date(selectedBatch.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 rounded-full border-[3px] border-slate-100 animate-spin"
            style={{ borderTopColor: BRAND }} />
          <p className="text-sm text-slate-400 font-medium">Loading checklists…</p>
        </div>
      ) : selectedBatchId ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {checklists
            .sort((a, b) => ({ pre: 1, during: 2, post: 3 }[a.type] - { pre: 1, during: 2, post: 3 }[b.type]))
            .map(checklist => {
              const Icon = getChecklistIcon(checklist.type);
              const doneCount = checklist.items.filter(i => i.status === 'done').length;
              const total = checklist.items.length;
              const pct = total > 0 ? (doneCount / total) * 100 : 0;
              const allDone = doneCount === total && total > 0;

              return (
                <div key={checklist.id} data-testid={`checklist-${checklist.type}`}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                  {/* Card header */}
                  <div className="p-4 border-b border-slate-50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ background: allDone ? '#22c55e' : `${BRAND}15` }}>
                        <Icon size={16} style={{ color: allDone ? '#fff' : BRAND }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-900 text-sm">{getChecklistTitle(checklist.type)}</h3>
                        <p className="text-xs text-slate-400">{doneCount}/{total} completed</p>
                      </div>
                      <span className="text-sm font-black tabular-nums"
                        style={{ color: allDone ? '#22c55e' : BRAND }}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: allDone ? '#22c55e' : BRAND }} />
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="divide-y divide-slate-50">
                    {checklist.items.map((item, idx) => (
                      <label key={idx} data-testid={`checklist-item-${idx}`}
                        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors group">
                        <Checkbox
                          checked={item.status === 'done'}
                          onCheckedChange={() => toggleItemStatus(checklist.id, idx, item.status)}
                          className="w-5 h-5 flex-shrink-0"
                        />
                        <p className={`text-sm flex-1 transition-colors leading-snug ${
                          item.status === 'done' ? 'line-through text-slate-300' : 'text-slate-700 group-hover:text-slate-900'
                        }`}>
                          {item.task}
                        </p>
                        {item.status === 'done' && (
                          <CheckCircle2 size={14} className="flex-shrink-0 text-green-400" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 flex flex-col items-center gap-3 text-center px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: `${BRAND}12` }}>
            <CheckSquare size={28} style={{ color: BRAND }} />
          </div>
          <p className="font-bold text-slate-800">Select a batch to begin</p>
          <p className="text-sm text-slate-400 max-w-xs">
            Choose a batch above to view and manage pre, during, and post-trek task checklists.
          </p>
        </div>
      )}
    </div>
  );
};

export default Checklists;
