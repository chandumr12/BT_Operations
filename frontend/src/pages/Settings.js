import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Plus, X } from 'lucide-react';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    categories: [],
    difficultyLevels: [],
    trekTypes: [],
    batchStatuses: []
  });
  
  const [newValues, setNewValues] = useState({
    category: '',
    difficultyLevel: '',
    trekType: '',
    batchStatus: '',
    taskCategory: ''
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/config');
      if (response.data) {
        setConfig(response.data);
      }
    } catch (error) {
      // If config doesn't exist, use defaults
      setConfig({
        categories: ['Karnataka', 'Kerala', 'Himalayas', 'Sunrise', 'Backpacking', 'Kids Batch'],
        difficultyLevels: ['Easy', 'Moderate', 'Difficult', 'Very Difficult'],
        trekTypes: ['1-day', '2-day', 'Himalayan'],
        batchStatuses: ['Open', 'Filling Fast', 'Full', 'Closed', 'Completed', 'Cancelled'],
        taskCategories: ['Operations', 'Sales', 'Content', 'Development', 'Trek Planning']
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      await api.post('/config', config);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const addValue = (field, value) => {
    if (!value.trim()) return;
    
    const fieldMap = {
      category: 'categories',
      difficultyLevel: 'difficultyLevels',
      trekType: 'trekTypes',
      batchStatus: 'batchStatuses',
      taskCategory: 'taskCategories'
    };
    
    const configField = fieldMap[field];
    
    if (!config[configField].includes(value.trim())) {
      setConfig({
        ...config,
        [configField]: [...config[configField], value.trim()]
      });
      setNewValues({...newValues, [field]: ''});
    }
  };

  const removeValue = (field, value) => {
    const fieldMap = {
      category: 'categories',
      difficultyLevel: 'difficultyLevels',
      trekType: 'trekTypes',
      batchStatus: 'batchStatuses',
      taskCategory: 'taskCategories'
    };
    
    const configField = fieldMap[field];
    
    setConfig({
      ...config,
      [configField]: config[configField].filter(v => v !== value)
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div data-testid="settings-page" className="space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold heading-font text-slate-900">Settings</h1>
          <p className="text-slate-600 text-sm mt-1">Manage dropdown options and system configuration</p>
        </div>
        <Button onClick={saveConfig} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20">
          <SettingsIcon size={20} className="mr-2" />
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Categories */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="heading-font text-lg">Trek Categories</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="flex gap-2">
              <Input
                value={newValues.category}
                onChange={(e) => setNewValues({...newValues, category: e.target.value})}
                placeholder="Add new category"
                onKeyPress={(e) => e.key === 'Enter' && addValue('category', newValues.category)}
                className="bg-white"
              />
              <Button onClick={() => addValue('category', newValues.category)} size="sm">
                <Plus size={16} />
              </Button>
            </div>
            <div className="space-y-2">
              {config.categories.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-slate-700 text-sm">{cat}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeValue('category', cat)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Difficulty Levels */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="heading-font text-lg">Difficulty Levels</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="flex gap-2">
              <Input
                value={newValues.difficultyLevel}
                onChange={(e) => setNewValues({...newValues, difficultyLevel: e.target.value})}
                placeholder="Add new level"
                onKeyPress={(e) => e.key === 'Enter' && addValue('difficultyLevel', newValues.difficultyLevel)}
                className="bg-white"
              />
              <Button onClick={() => addValue('difficultyLevel', newValues.difficultyLevel)} size="sm">
                <Plus size={16} />
              </Button>
            </div>
            <div className="space-y-2">
              {config.difficultyLevels.map((level, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-slate-700">{level}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeValue('difficultyLevel', level)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trek Types */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="heading-font text-lg">Trek Types</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="flex gap-2">
              <Input
                value={newValues.trekType}
                onChange={(e) => setNewValues({...newValues, trekType: e.target.value})}
                placeholder="Add new type"
                onKeyPress={(e) => e.key === 'Enter' && addValue('trekType', newValues.trekType)}
                className="bg-white"
              />
              <Button onClick={() => addValue('trekType', newValues.trekType)} size="sm">
                <Plus size={16} />
              </Button>
            </div>
            <div className="space-y-2">
              {config.trekTypes.map((type, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-slate-700">{type}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeValue('trekType', type)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Batch Statuses */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="heading-font text-lg">Batch Statuses</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="flex gap-2">
              <Input
                value={newValues.batchStatus}
                onChange={(e) => setNewValues({...newValues, batchStatus: e.target.value})}
                placeholder="Add new status"
                onKeyPress={(e) => e.key === 'Enter' && addValue('batchStatus', newValues.batchStatus)}
                className="bg-white"
              />
              <Button onClick={() => addValue('batchStatus', newValues.batchStatus)} size="sm">
                <Plus size={16} />
              </Button>
            </div>
            <div className="space-y-2">
              {config.batchStatuses.map((status, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-slate-700">{status}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeValue('batchStatus', status)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Task Categories */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="heading-font text-lg">Task Categories</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="flex gap-2">
              <Input
                value={newValues.taskCategory}
                onChange={(e) => setNewValues({...newValues, taskCategory: e.target.value})}
                placeholder="Add new category"
                onKeyPress={(e) => e.key === 'Enter' && addValue('taskCategory', newValues.taskCategory)}
                className="bg-white"
              />
              <Button onClick={() => addValue('taskCategory', newValues.taskCategory)} size="sm">
                <Plus size={16} />
              </Button>
            </div>
            <div className="space-y-2">
              {(config.taskCategories || []).map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-slate-700">{cat}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeValue('taskCategory', cat)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> After adding or removing options, click "Save Settings" to apply changes.
            These options will be immediately available in the Trek Master and Batch Planning forms.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
