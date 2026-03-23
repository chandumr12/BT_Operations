import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const BADGE_ORDER = ['kumara_parvatha', 'kedarkantha', 'roopkund', 'trishul', 'nanda_devi', 'everester'];

export default function MyVouchers() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    api.get('/badges/vouchers')
      .then(res => setVouchers(
        (res.data || []).sort((a, b) => BADGE_ORDER.indexOf(a.tierId) - BADGE_ORDER.indexOf(b.tierId))
      ))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyCode = (code, tierId) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(tierId);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Vouchers</h1>
        <p className="text-gray-500 text-sm mt-1">
          Your earned badge goodies — redeem them with the admin.
        </p>
      </div>

      {vouchers.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
          <p className="text-5xl mb-4">🏔️</p>
          <p className="text-lg font-semibold text-gray-700">No vouchers yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Complete 5+ batches and claim your first Kumara Parvatha badge!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {vouchers.map(v => (
            <div
              key={v.tierId}
              className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden"
            >
              {/* Top bar */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 flex items-center gap-3">
                <span className="text-3xl">{v.emoji}</span>
                <div>
                  <p className="text-white font-bold text-base leading-tight">{v.tierName}</p>
                  <p className="text-purple-200 text-xs">{v.elevation}</p>
                </div>
                <span className="ml-auto text-xs text-purple-200">
                  {v.claimedAt ? new Date(v.claimedAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  }) : ''}
                </span>
              </div>

              {/* Body */}
              <div className="p-5 flex flex-col gap-4">
                {/* Voucher code */}
                <div className="bg-gray-50 border border-dashed border-purple-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Voucher Code</p>
                    <p className="font-mono font-bold text-purple-700 text-lg tracking-widest">{v.voucherCode}</p>
                  </div>
                  <button
                    onClick={() => copyCode(v.voucherCode, v.tierId)}
                    className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                      copied === v.tierId
                        ? 'bg-green-100 text-green-700'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {copied === v.tierId ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Goodie */}
                <div className="flex gap-4 items-start">
                  {v.goodiePicUrl && (
                    <img
                      src={v.goodiePicUrl}
                      alt="goodie"
                      className="w-24 h-24 object-cover rounded-xl flex-shrink-0 border border-gray-100"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your Goodie</p>
                    {v.goodieDescription ? (
                      <p className="text-gray-800 text-sm leading-relaxed">{v.goodieDescription}</p>
                    ) : (
                      <p className="text-gray-400 italic text-sm">
                        Goodie details coming soon — the admin is finalising your reward. Stay tuned! 🎁
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
