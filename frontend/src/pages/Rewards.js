import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

const TIERS = [
  { id: 'kumara_parvatha', name: 'Kumara Parvatha', elevation: '1,712m', minBatches: 5,  emoji: '🏔️' },
  { id: 'kedarkantha',     name: 'Kedarkantha',     elevation: '3,810m', minBatches: 10, emoji: '⛰️' },
  { id: 'roopkund',        name: 'Roopkund',        elevation: '5,029m', minBatches: 20, emoji: '🗻' },
  { id: 'trishul',         name: 'Trishul',         elevation: '7,120m', minBatches: 30, emoji: '🌟' },
  { id: 'nanda_devi',      name: 'Nanda Devi',      elevation: '7,816m', minBatches: 40, emoji: '💎' },
  { id: 'everester',       name: 'Everester',       elevation: '8,849m', minBatches: 50, emoji: '🏆' },
];

export default function Rewards() {
  const [configs, setConfigs] = useState({});
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});
  const [uploading, setUploading] = useState({});
  const [vouchers, setVouchers] = useState([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [activeTab, setActiveTab] = useState('config');
  const fileRefs = useRef({});

  useEffect(() => {
    fetchConfigs();
    fetchVouchers();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/badge-config');
      const map = {};
      res.data.forEach(t => { map[t.id] = t; });
      setConfigs(map);
      const editMap = {};
      res.data.forEach(t => {
        editMap[t.id] = { goodieDescription: t.goodieDescription || '' };
      });
      setEditing(editMap);
    } catch (err) {
      console.error('Failed to load badge configs', err);
    }
  };

  const fetchVouchers = async () => {
    setLoadingVouchers(true);
    try {
      const res = await api.get('/badges/vouchers/all');
      setVouchers(res.data || []);
    } catch (err) {
      console.error('Failed to load vouchers', err);
    } finally {
      setLoadingVouchers(false);
    }
  };

  const handleSave = async (tierId) => {
    setSaving(s => ({ ...s, [tierId]: true }));
    try {
      await api.put(`/badge-config/${tierId}`, {
        goodieDescription: editing[tierId]?.goodieDescription || '',
      });
      await fetchConfigs();
    } catch (err) {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(s => ({ ...s, [tierId]: false }));
    }
  };

  const handleImageUpload = async (tierId, file) => {
    if (!file) return;
    setUploading(u => ({ ...u, [tierId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/badge-config/${tierId}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchConfigs();
    } catch (err) {
      alert('Image upload failed. Please try again.');
    } finally {
      setUploading(u => ({ ...u, [tierId]: false }));
    }
  };

  const tierColors = {
    kumara_parvatha: 'from-amber-50 to-amber-100 border-amber-200',
    kedarkantha:     'from-slate-50 to-slate-100 border-slate-200',
    roopkund:        'from-yellow-50 to-yellow-100 border-yellow-200',
    trishul:         'from-purple-50 to-purple-100 border-purple-200',
    nanda_devi:      'from-cyan-50 to-cyan-100 border-cyan-200',
    everester:       'from-orange-50 to-orange-100 border-orange-200',
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rewards & Badges</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure goodies for each milestone badge. Leads see the goodie only after they claim their badge.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {['config', 'claimed'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'config' ? '⚙️ Badge Configuration' : `🎫 Claimed Vouchers (${vouchers.length})`}
          </button>
        ))}
      </div>

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIERS.map(tier => {
            const cfg = configs[tier.id] || {};
            const edit = editing[tier.id] || {};
            const isSaving = saving[tier.id];
            const isUploading = uploading[tier.id];

            return (
              <div
                key={tier.id}
                className={`rounded-xl border bg-gradient-to-br ${tierColors[tier.id]} p-4 flex flex-col gap-3`}
              >
                {/* Tier header */}
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{tier.emoji}</span>
                  <div>
                    <p className="font-bold text-gray-900">{tier.name}</p>
                    <p className="text-xs text-gray-500">{tier.elevation} · {tier.minBatches} batches</p>
                  </div>
                </div>

                {/* Goodie description */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Goodie Description</label>
                  <textarea
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="e.g. ₹500 Amazon voucher, BT branded backpack..."
                    value={edit.goodieDescription || ''}
                    onChange={e =>
                      setEditing(prev => ({
                        ...prev,
                        [tier.id]: { ...prev[tier.id], goodieDescription: e.target.value },
                      }))
                    }
                  />
                </div>

                {/* Image upload */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Goodie Photo</label>
                  {cfg.goodiePicUrl && (
                    <img
                      src={cfg.goodiePicUrl}
                      alt="goodie"
                      className="w-full h-32 object-cover rounded-lg mb-2 border border-gray-200"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    ref={el => (fileRefs.current[tier.id] = el)}
                    className="hidden"
                    onChange={e => handleImageUpload(tier.id, e.target.files[0])}
                  />
                  <button
                    onClick={() => fileRefs.current[tier.id]?.click()}
                    disabled={isUploading}
                    className="w-full text-sm border border-dashed border-gray-300 rounded-lg py-2 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors bg-white"
                  >
                    {isUploading ? '⏳ Uploading...' : cfg.goodiePicUrl ? '🔄 Replace Photo' : '📷 Upload Photo'}
                  </button>
                </div>

                {/* Save button */}
                <button
                  onClick={() => handleSave(tier.id)}
                  disabled={isSaving}
                  className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : '💾 Save'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Claimed Vouchers Tab */}
      {activeTab === 'claimed' && (
        <div>
          {loadingVouchers ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : vouchers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🎫</p>
              <p>No vouchers claimed yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Lead', 'Badge', 'Voucher Code', 'Goodie', 'Claimed At'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{v.displayName || v.userId}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1">
                          {v.emoji} {v.tierName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{v.voucherCode}</code>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {v.goodieDescription || <span className="text-gray-400 italic">Not configured</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {v.claimedAt ? new Date(v.claimedAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        }) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
