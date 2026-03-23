// src/utils/finance.js
export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const toMonthKey = (d) => {
  if (!d) return '';
  try {
    const dt = typeof d === 'string' ? new Date(d) : d.toDate ? d.toDate() : new Date(d);
    const y = dt.getFullYear();
    const m = `${dt.getMonth() + 1}`.padStart(2, '0');
    return `${y}-${m}`;
  } catch {
    return String(d).slice(0, 7);
  }
};

export const paginate = (arr, page, size) => {
  const start = (page - 1) * size;
  return arr.slice(start, start + size);
};