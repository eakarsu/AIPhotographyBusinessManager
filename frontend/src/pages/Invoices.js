import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyInvoice = { invoice_number: '', client_id: '', items: [], subtotal: 0, tax_rate: 8.25, tax_amount: 0, total: 0, status: 'Draft', due_date: '', notes: '' };

export default function Invoices({ token }) {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyInvoice);
  const [editing, setEditing] = useState(false);
  const [lineItems, setLineItems] = useState([{ description: '', qty: 1, price: 0 }]);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const [iRes, cRes] = await Promise.all([
        axios.get(`${API}/api/invoices`, { headers }),
        axios.get(`${API}/api/clients`, { headers })
      ]);
      setItems(iRes.data);
      setClients(cRes.data);
    } catch (err) { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const calculateTotals = (items, taxRate) => {
    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const taxAmount = subtotal * (taxRate / 100);
    return { subtotal, tax_amount: Math.round(taxAmount * 100) / 100, total: Math.round((subtotal + taxAmount) * 100) / 100 };
  };

  const updateLineItem = (idx, field, value) => {
    const updated = [...lineItems];
    updated[idx][field] = field === 'description' ? value : parseFloat(value) || 0;
    setLineItems(updated);
    const totals = calculateTotals(updated, form.tax_rate);
    setForm({ ...form, items: updated, ...totals });
  };

  const addLineItem = () => setLineItems([...lineItems, { description: '', qty: 1, price: 0 }]);
  const removeLineItem = (idx) => {
    const updated = lineItems.filter((_, i) => i !== idx);
    setLineItems(updated);
    const totals = calculateTotals(updated, form.tax_rate);
    setForm({ ...form, items: updated, ...totals });
  };

  const handleSave = async () => {
    try {
      const data = { ...form, items: lineItems };
      if (editing) {
        await axios.put(`${API}/api/invoices/${form.id}`, data, { headers });
        toast.success('Invoice updated');
      } else {
        await axios.post(`${API}/api/invoices`, data, { headers });
        toast.success('Invoice created');
      }
      setShowForm(false); setForm(emptyInvoice); setEditing(false); setSelected(null);
      setLineItems([{ description: '', qty: 1, price: 0 }]);
      fetchData();
    } catch (err) { toast.error('Failed to save invoice'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await axios.delete(`${API}/api/invoices/${id}`, { headers });
      toast.success('Invoice deleted'); setSelected(null); fetchData();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleEdit = (item) => {
    const parsedItems = typeof item.items === 'string' ? JSON.parse(item.items) : (item.items || []);
    setLineItems(parsedItems.length > 0 ? parsedItems : [{ description: '', qty: 1, price: 0 }]);
    setForm(item); setEditing(true); setShowForm(true); setSelected(null);
  };

  const handleNew = () => {
    const num = `INV-${new Date().getFullYear()}-${String(items.length + 1).padStart(3, '0')}`;
    setForm({ ...emptyInvoice, invoice_number: num });
    setLineItems([{ description: '', qty: 1, price: 0 }]);
    setEditing(false); setShowForm(true);
  };

  const statusBadge = (s) => {
    const m = { Paid: 'badge-success', Pending: 'badge-warning', Draft: 'badge-draft', Overdue: 'badge-danger' };
    return m[s] || 'badge-draft';
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading invoices...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Invoices</h1><p>Manage billing and payments</p></div>
        <button className="btn btn-primary" onClick={handleNew}>+ New Invoice</button>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div><h2>{selected.invoice_number}</h2><span className={`badge ${statusBadge(selected.status)}`}>{selected.status}</span></div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Client</label><div className="value">{selected.client_name || 'N/A'}</div></div>
            <div className="detail-field"><label>Subtotal</label><div className="value">${parseFloat(selected.subtotal).toLocaleString()}</div></div>
            <div className="detail-field"><label>Tax ({selected.tax_rate}%)</label><div className="value">${parseFloat(selected.tax_amount).toLocaleString()}</div></div>
            <div className="detail-field"><label>Total</label><div className="value" style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>${parseFloat(selected.total).toLocaleString()}</div></div>
            <div className="detail-field"><label>Due Date</label><div className="value">{selected.due_date ? new Date(selected.due_date).toLocaleDateString() : 'N/A'}</div></div>
            <div className="detail-field"><label>Notes</label><div className="value">{selected.notes || 'None'}</div></div>
          </div>
          {selected.items && (
            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Line Items</label>
              <table className="data-table" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                <tbody>
                  {(typeof selected.items === 'string' ? JSON.parse(selected.items) : selected.items).map((item, i) => (
                    <tr key={i} style={{ cursor: 'default' }}>
                      <td>{item.description}</td><td>{item.qty}</td><td>${item.price}</td><td>${(item.qty * item.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Invoice #</th><th>Client</th><th>Total</th><th>Status</th><th>Due Date</th></tr></thead>
          <tbody>
            {items.map(inv => (
              <tr key={inv.id} onClick={() => setSelected(inv)}>
                <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                <td>{inv.client_name || 'N/A'}</td>
                <td style={{ fontWeight: 600 }}>${parseFloat(inv.total).toLocaleString()}</td>
                <td><span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span></td>
                <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Invoice' : 'New Invoice'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyInvoice); setLineItems([{ description: '', qty: 1, price: 0 }]); }}
          footer={<><button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button></>}
        >
          <div className="form-row">
            <div className="form-group"><label>Invoice Number</label><input value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} /></div>
            <div className="form-group">
              <label>Client</label>
              <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Line Items</label>
          {lineItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input style={{ flex: 3, padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }}
                value={item.description} onChange={e => updateLineItem(i, 'description', e.target.value)} placeholder="Description" />
              <input style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }}
                type="number" value={item.qty} onChange={e => updateLineItem(i, 'qty', e.target.value)} placeholder="Qty" />
              <input style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }}
                type="number" value={item.price} onChange={e => updateLineItem(i, 'price', e.target.value)} placeholder="Price" />
              <button className="btn btn-danger btn-sm" onClick={() => removeLineItem(i)} style={{ padding: '8px 12px' }}>&times;</button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addLineItem} style={{ marginBottom: 16 }}>+ Add Item</button>

          <div className="form-row">
            <div className="form-group"><label>Tax Rate (%)</label><input type="number" value={form.tax_rate} onChange={e => { const rate = parseFloat(e.target.value) || 0; const totals = calculateTotals(lineItems, rate); setForm({...form, tax_rate: rate, ...totals}); }} /></div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Draft</option><option>Pending</option><option>Paid</option><option>Overdue</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Due Date</label><input type="date" value={form.due_date ? form.due_date.substring(0, 10) : ''} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
            <div className="form-group">
              <label>Total</label>
              <div style={{ padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>
                ${form.total?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
          <div className="form-group"><label>Notes</label><textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Invoice notes..." /></div>
        </Modal>
      )}
    </div>
  );
}
