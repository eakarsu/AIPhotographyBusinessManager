import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function InvoicePDF({ token }) {
  const [data, setData] = useState(null);
  const [clientId, setClientId] = useState('');
  const [shootId, setShootId] = useState('');
  const [notes, setNotes] = useState('');
  const [extraDesc, setExtraDesc] = useState('Retouching & color grading');
  const [extraQty, setExtraQty] = useState(1);
  const [extraPrice, setExtraPrice] = useState(150);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/api/custom-views/invoice-pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => { if (!cancelled) { setData(res.data); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.message || 'load failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const filteredShoots = useMemo(() => {
    if (!data) return [];
    if (!clientId) return data.sessions;
    return data.sessions.filter(s => String(s.client_id) === String(clientId));
  }, [data, clientId]);

  const selectedShoot = useMemo(() => {
    if (!data) return null;
    return data.sessions.find(s => String(s.id) === String(shootId)) || null;
  }, [data, shootId]);

  const subtotal = useMemo(() => {
    const base = selectedShoot ? Number(selectedShoot.price || 0) : 0;
    const extras = Number(extraQty) * Number(extraPrice || 0);
    return base + (isFinite(extras) ? extras : 0);
  }, [selectedShoot, extraQty, extraPrice]);

  const tax = useMemo(() => +(subtotal * 8.25 / 100).toFixed(2), [subtotal]);
  const total = useMemo(() => +(subtotal + tax).toFixed(2), [subtotal, tax]);

  const generate = async () => {
    if (!clientId || !shootId) {
      setError('Pick a client and a session first.');
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await axios.post(
        `${API}/api/custom-views/invoice-pdf`,
        {
          client_id: parseInt(clientId, 10),
          shoot_id: parseInt(shootId, 10),
          extra_items: extraDesc ? [{ description: extraDesc, qty: Number(extraQty), price: Number(extraPrice) }] : [],
          notes
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
          validateStatus: () => true
        }
      );
      const ctype = res.headers['content-type'] || '';
      if (ctype.includes('application/pdf')) {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${shootId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setLastResult({ ok: true, kind: 'pdf', total });
      } else {
        const text = await res.data.text();
        try {
          const j = JSON.parse(text);
          setLastResult({ ok: !!j.ok, kind: 'json', payload: j });
          if (!j.ok && j.error) setError(j.error);
        } catch {
          setError('Unexpected non-PDF response');
        }
      }
    } catch (e) {
      setError(e.message || 'PDF generation failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: '#cbd5e1' }}>Loading invoice builder…</div>;

  return (
    <div data-testid="invoice-pdf" style={{ background: '#0f172a', borderRadius: 14, padding: 18, color: '#e2e8f0' }}>
      <h3 style={{ margin: 0, color: '#f1f5f9' }}>Invoice PDF</h3>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
        Pick a client + session, add optional line items, generate a downloadable PDF.
        {!data?.pdfReady && <span style={{ color: '#fbbf24' }}> (pdfkit not installed — returns JSON)</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label style={lbl}>Client
          <select value={clientId} onChange={e => { setClientId(e.target.value); setShootId(''); }} style={inp}>
            <option value="">— Select client —</option>
            {(data?.clients || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label style={lbl}>Session
          <select value={shootId} onChange={e => setShootId(e.target.value)} style={inp}>
            <option value="">— Select session —</option>
            {filteredShoots.map(s => (
              <option key={s.id} value={s.id}>
                {s.title} — ${Number(s.price || 0).toFixed(0)} ({s.shoot_date ? String(s.shoot_date).slice(0,10) : 'n/a'})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: 14, padding: 12, background: '#1e293b', borderRadius: 10, border: '1px solid #334155' }}>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Line items</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
          <label style={lbl}>Extra description
            <input value={extraDesc} onChange={e => setExtraDesc(e.target.value)} style={inp} />
          </label>
          <label style={lbl}>Qty
            <input type="number" value={extraQty} onChange={e => setExtraQty(e.target.value)} style={inp} />
          </label>
          <label style={lbl}>Price
            <input type="number" value={extraPrice} onChange={e => setExtraPrice(e.target.value)} style={inp} />
          </label>
        </div>
      </div>

      <label style={{ ...lbl, marginTop: 12, display: 'block' }}>Notes
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
      </label>

      <div style={{ marginTop: 12, padding: 12, background: '#0b1220', borderRadius: 10, border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Subtotal</span><strong>${subtotal.toFixed(2)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Tax (8.25%)</span><strong>${tax.toFixed(2)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: '#a78bfa', fontSize: 18 }}>
          <span>Total</span><strong>${total.toFixed(2)}</strong>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
          Payment terms: <em>Net 14 days. Late fee 1.5%/month.</em>
        </div>
      </div>

      <button onClick={generate} disabled={generating} style={btnPrimary}>
        {generating ? 'Generating…' : 'Generate Invoice PDF'}
      </button>

      {error && <div style={{ marginTop: 10, color: '#fca5a5' }}>{error}</div>}
      {lastResult && lastResult.kind === 'pdf' && (
        <div style={{ marginTop: 10, color: '#10ac84' }}>
          PDF downloaded — total ${lastResult.total.toFixed(2)}.
        </div>
      )}
      {lastResult && lastResult.kind === 'json' && (
        <pre style={{ marginTop: 10, padding: 10, background: '#0b1220', borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 220 }}>
          {JSON.stringify(lastResult.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

const lbl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#cbd5e1' };
const inp = {
  background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155',
  borderRadius: 6, padding: '6px 10px', fontSize: 13
};
const btnPrimary = {
  marginTop: 14, background: '#5f27cd', color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 16px', fontWeight: 600, cursor: 'pointer'
};
