import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { CheckSquare, ListChecks, Clock } from 'lucide-react';

const Checklists = () => {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchChecklists(selectedBatchId);
    }
  }, [selectedBatchId]);

  const fetchBatches = async () => {
    try {
      const response = await api.get('/batches');
      setBatches(response.data);
    } catch (error) {
      toast.error('Failed to fetch batches');
    }
  };

  const fetchChecklists = async (batchId) => {
    setLoading(true);
    try {
      const response = await api.get(`/checklists/${batchId}`);
      if (response.data.length === 0) {
        // Create default checklists
        await createDefaultChecklists(batchId);
        const newResponse = await api.get(`/checklists/${batchId}`);
        setChecklists(newResponse.data);
      } else {
        setChecklists(response.data);
      }
    } catch (error) {
      toast.error('Failed to fetch checklists');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultChecklists = async (batchId) => {
    const defaultChecklists = [
      {
        batchId,
        type: 'pre',
        items: [
          { task: 'Transport confirmed', status: 'pending', assignedTo: '' },
          { task: 'Stay confirmed', status: 'pending', assignedTo: '' },
          { task: 'Forest permits confirmed', status: 'pending', assignedTo: '' },
          { task: 'Participant list finalized', status: 'pending', assignedTo: '' },
          { task: 'Medical kit assigned', status: 'pending', assignedTo: '' },
          { task: 'ID cards printed', status: 'pending', assignedTo: '' },
          { task: 'Badges packed', status: 'pending', assignedTo: '' }
        ]
      },
      {
        batchId,
        type: 'during',
        items: [
          { task: 'Attendance marked', status: 'pending', assignedTo: '' },
          { task: 'Emergency contact list shared', status: 'pending', assignedTo: '' },
          { task: 'Photos uploaded', status: 'pending', assignedTo: '' }
        ]
      },
      {
        batchId,
        type: 'post',
        items: [
          { task: 'Feedback collected', status: 'pending', assignedTo: '' },
          { task: 'Incident report (if any)', status: 'pending', assignedTo: '' },
          { task: 'Trek marked as completed', status: 'pending', assignedTo: '' }
        ]
      }
    ];

    for (const checklist of defaultChecklists) {
      await api.post('/checklists', checklist);
    }
  };

  const toggleItemStatus = async (checklistId, itemIndex, currentStatus) => {
    try {
      const checklist = checklists.find(c => c.id === checklistId);
      const updatedItems = [...checklist.items];
      updatedItems[itemIndex].status = currentStatus === 'done' ? 'pending' : 'done';
      
      await api.patch(`/checklists/${checklistId}`, { items: updatedItems });
      fetchChecklists(selectedBatchId);
      toast.success('Checklist updated');
    } catch (error) {
      toast.error('Failed to update checklist');
    }
  };

  const getChecklistTitle = (type) => {
    switch(type) {
      case 'pre': return 'Pre-Trek Checklist';
      case 'during': return 'During Trek Checklist';
      case 'post': return 'Post-Trek Checklist';
      default: return 'Checklist';
    }
  };

  const getChecklistIcon = (type) => {
    switch(type) {
      case 'pre': return Clock;
      case 'during': return CheckSquare;
      case 'post': return ListChecks;
      default: return CheckSquare;
    }
  };

  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  return (
    <div data-testid="checklists-page" className="space-y-5 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold heading-font text-slate-900">Operational Checklists</h1>
        <p className="text-slate-600 text-sm mt-1">Track pre, during, and post-trek tasks</p>
      </div>

      <div className="max-w-md">
        <Label className="text-slate-900 font-medium mb-2 block">Select Batch</Label>
        <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
          <SelectTrigger data-testid="batch-selector" className="bg-white">
            <SelectValue placeholder="Select a batch" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {batches.map(batch => (
              <SelectItem key={batch.id} value={batch.id}>
                {batch.batchCode} - {new Date(batch.startDate).toLocaleDateString('en-IN')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedBatch && (
        <Card className="border-slate-100 shadow-sm bg-gradient-to-r from-blue-50 to-green-50">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold heading-font mb-2">{selectedBatch.batchCode}</h3>
            <p className="text-slate-600">
              {new Date(selectedBatch.startDate).toLocaleDateString('en-IN')} - {new Date(selectedBatch.endDate).toLocaleDateString('en-IN')}
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : selectedBatchId ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {checklists.sort((a, b) => {
            const order = { pre: 1, during: 2, post: 3 };
            return order[a.type] - order[b.type];
          }).map((checklist) => {
            const Icon = getChecklistIcon(checklist.type);
            const completedCount = checklist.items.filter(item => item.status === 'done').length;
            const totalCount = checklist.items.length;
            const progress = (completedCount / totalCount) * 100;

            return (
              <Card key={checklist.id} data-testid={`checklist-${checklist.type}`} className="border-slate-100 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50">
                  <CardTitle className="heading-font flex items-center gap-2">
                    <Icon className="text-blue-600" size={20} />
                    {getChecklistTitle(checklist.type)}
                  </CardTitle>
                  <div className="mt-2">
                    <div className="flex justify-between text-sm text-slate-600 mb-1">
                      <span>{completedCount}/{totalCount} completed</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {checklist.items.map((item, idx) => (
                    <div key={idx} data-testid={`checklist-item-${idx}`} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <Checkbox
                        checked={item.status === 'done'}
                        onCheckedChange={() => toggleItemStatus(checklist.id, idx, item.status)}
                      />
                      <div className="flex-1">
                        <p className={`text-sm ${item.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {item.task}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-12 text-center">
            <CheckSquare size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">Select a batch to view checklists</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Checklists;
