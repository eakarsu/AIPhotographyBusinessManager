import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function BookingCalendar({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${API}/api/custom-views/booking-calendar?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => { if (!cancelled) { setData(res.data); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.message || 'load failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, month]);

  const grid = useMemo(() => {
    if (!data) return [];
    const cells = [];
    for (let i = 0; i < data.firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= data.daysInMonth; d++) {
      const dateStr = `${data.year}-${String(data.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const events = data.events.filter(e => e.date === dateStr);
      cells.push({ day: d, dateStr, events });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [data]);

  const monthLabel = useMemo(() => {
    if (!data) return month;
    const dt = new Date(Date.UTC(data.year, data.month - 1, 1));
    return dt.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, [data, month]);

  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  if (loading) return <div style={{ padding: 24, color: '#cbd5e1' }}>Loading booking calendar…</div>;
  if (error)   return <div style={{ padding: 24, color: '#fca5a5' }}>Error: {error}</div>;
  if (!data)   return null;

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div data-testid="booking-calendar" style={{ background: '#0f172a', borderRadius: 14, padding: 18, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, color: '#f1f5f9' }}>Booking Calendar</h3>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            {data.counts.bookings} bookings · {data.counts.shoots} shoots this month
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => shiftMonth(-1)} style={navBtn}>‹</button>
          <strong style={{ minWidth: 160, textAlign: 'center' }}>{monthLabel}</strong>
          <button onClick={() => shiftMonth(1)} style={navBtn}>›</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {data.photographers.map(p => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: p.color, display: 'inline-block' }} />
            <span style={{ color: '#cbd5e1' }}>{p.name}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {dayHeaders.map(d => (
          <div key={d} style={{ color: '#94a3b8', fontSize: 12, padding: '4px 6px', textAlign: 'center' }}>{d}</div>
        ))}
        {grid.map((cell, idx) => (
          <div key={idx} style={{
            minHeight: 92, background: cell ? '#1e293b' : 'transparent',
            border: cell ? '1px solid #334155' : 'none',
            borderRadius: 8, padding: 6, position: 'relative'
          }}>
            {cell && (
              <>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{cell.day}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                  {cell.events.slice(0, 3).map(ev => (
                    <div
                      key={ev.id}
                      title={`${ev.title} — ${ev.photographer} (${ev.status})`}
                      style={{
                        fontSize: 10, padding: '2px 5px', borderRadius: 4,
                        background: ev.photographerColor + '33',
                        borderLeft: `3px solid ${ev.statusColor}`,
                        color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}
                    >
                      {ev.kind === 'shoot' ? '📷' : '📩'} {ev.title}
                    </div>
                  ))}
                  {cell.events.length > 3 && (
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>+{cell.events.length - 3} more</div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const navBtn = {
  background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
  borderRadius: 6, padding: '4px 10px', cursor: 'pointer'
};
