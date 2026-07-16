import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const BRAND = '#f1563f';
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
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-slate-100"
          style={{ borderTopColor: BRAND }} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 heading-font">My Vouchers</h1>
        <p className="text-slate-400 text-sm mt-1">Your earned badge goodies — redeem them with the admin.</p>
      </div>

      {vouchers.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-slate-200 bg-white">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `${BRAND}12` }}>
            <span className="text-3xl">🏔️</span>
          </div>
          <p className="text-base font-bold text-slate-800">No vouchers yet</p>
          <p className="text-sm text-slate-400 mt-1.5 max-w-xs mx-auto">
            Complete 5+ batches and claim your first Kumara Parvatha badge!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {vouchers.map(v => (
            <div key={v.tierId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

              {/* Top bar — brand */}
              <div className="px-5 py-4 flex items-center gap-3 text-white" style={{ background: BRAND }}>
                <span className="text-3xl leading-none flex-shrink-0">{v.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-base leading-tight">{v.tierName}</p>
                  <p className="text-white/65 text-xs">{v.elevation}</p>
                </div>
                {v.claimedAt && (
                  <span className="text-xs text-white/55 flex-shrink-0">
                    {new Date(v.claimedAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="p-5 flex flex-col gap-4">

                {/* Voucher code */}
                <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 border"
                  style={{ borderColor: `${BRAND}30`, background: `${BRAND}06` }}>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5 text-slate-400">Voucher Code</p>
                    <p className="font-mono font-black text-lg tracking-widest" style={{ color: BRAND }}>
                      {v.voucherCode}
                    </p>
                  </div>
                  <button
                    onClick={() => copyCode(v.voucherCode, v.tierId)}
                    className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                    style={copied === v.tierId
                      ? { background: '#dcfce7', color: '#16a34a' }
                      : { background: `${BRAND}15`, color: BRAND }}>
                    {copied === v.tierId ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Goodie */}
                <div className="flex gap-4 items-start">
                  {v.goodiePicUrl && (
                    <img src={v.goodiePicUrl} alt="goodie"
                      className="w-24 h-24 object-cover rounded-xl flex-shrink-0 border border-slate-100"
                      onError={e => { e.target.style.display = 'none'; }} />
                  )}
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Your Goodie</p>
                    {v.goodieDescription ? (
                      <p className="text-slate-800 text-sm leading-relaxed">{v.goodieDescription}</p>
                    ) : (
                      <p className="text-slate-400 italic text-sm">
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
