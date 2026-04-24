import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyExpense = { title: '', category: 'Equipment', amount: 0, expense_date: '', vendor: '', description: '', is_tax_deductible: false, status: 'Recorded' };

export default function Expenses({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyExpense);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/expenses`, { headers });
      setItems(res.data);
    } catch (err) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/expenses/${form.id}`, form, { headers });
        toast.success('Expense updated');
      } else {
        await axios.post(`${API}/api/expenses`, form, { headers });
        toast.success('Expense created');
      }
      setShowForm(false);
      setForm(emptyExpense);
      setEditing(false);
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save expense');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await axios.delete(`${API}/api/expenses/${id}`, { headers });
      toast.success('Expense deleted');
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(true);
    setShowForm(true);
    setSelected(null);
  };

  const handleNew = () => {
    setForm(emptyExpense);
    setEditing(false);
    setShowForm(true);
  };

  const statusBadge = (s) => {
    const map = { Recorded: 'badge-success', Pending: 'badge-warning', Reimbursed: 'badge-info' };
    return map[s] || 'badge-draft';
  };

  const formatAmount = (amt) => {
    return '$' + Number(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalExpenses = items.reduce((sum, e) => sum + Number(e.amount), 0);
  const taxDeductible = items.filter(e => e.is_tax_deductible).reduce((sum, e) => sum + Number(e.amount), 0);
  const now = new Date();
  const thisMonthCount = items.filter(e => {
    if (!e.expense_date) return false;
    const d = new Date(e.expense_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const categoriesCount = new Set(items.map(e => e.category)).size;

  if (loading) return <div className="loading"><div className="spinner"></div> Loading expenses...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <p>Track business expenses and tax deductions</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ Add Expense</button>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>Total Expenses</h3>
          <div className="stat-value">{formatAmount(totalExpenses)}</div>
        </div>
        <div className="stat-card">
          <h3>Tax Deductible</h3>
          <div className="stat-value">{formatAmount(taxDeductible)}</div>
        </div>
        <div className="stat-card">
          <h3>This Month</h3>
          <div className="stat-value">{thisMonthCount}</div>
        </div>
        <div className="stat-card">
          <h3>Categories</h3>
          <div className="stat-value">{categoriesCount}</div>
        </div>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selected.title}</h2>
              <span className={`badge ${statusBadge(selected.status)}`}>{selected.status}</span>
            </div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Category</label><div className="value">{selected.category}</div></div>
            <div className="detail-field"><label>Amount</label><div className="value" style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{formatAmount(selected.amount)}</div></div>
            <div className="detail-field"><label>Vendor</label><div className="value">{selected.vendor || 'N/A'}</div></div>
            <div className="detail-field"><label>Date</label><div className="value">{selected.expense_date ? new Date(selected.expense_date).toLocaleDateString() : 'N/A'}</div></div>
            <div className="detail-field"><label>Tax Deductible</label><div className="value">{selected.is_tax_deductible ? 'Yes' : 'No'}</div></div>
            <div className="detail-field"><label>Status</label><div className="value">{selected.status}</div></div>
            <div className="detail-field"><label>Description</label><div className="value">{selected.description || 'No description'}</div></div>
            <div className="detail-field"><label>Created</label><div className="value">{selected.created_at ? new Date(selected.created_at).toLocaleDateString() : 'N/A'}</div></div>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Vendor</th>
              <th>Date</th>
              <th>Tax Deductible</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(e => (
              <tr key={e.id} onClick={() => setSelected(e)}>
                <td style={{ fontWeight: 600 }}>{e.title}</td>
                <td>{e.category}</td>
                <td style={{ fontWeight: 600 }}>{formatAmount(e.amount)}</td>
                <td>{e.vendor || 'N/A'}</td>
                <td>{e.expense_date ? new Date(e.expense_date).toLocaleDateString() : 'N/A'}</td>
                <td>{e.is_tax_deductible ? 'Yes' : 'No'}</td>
                <td><span className={`badge ${statusBadge(e.status)}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Expense' : 'New Expense'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyExpense); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); setForm(emptyExpense); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <div className="form-group">
            <label>Title</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Expense title" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option>Equipment</option><option>Software</option><option>Studio</option><option>Insurance</option>
                <option>Travel</option><option>Supplies</option><option>Marketing</option><option>Education</option>
              </select>
            </div>
            <div className="form-group">
              <label>Amount</label>
              <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0.00" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Expense Date</label>
              <input type="date" value={form.expense_date ? form.expense_date.substring(0, 10) : ''} onChange={e => setForm({...form, expense_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Vendor</label>
              <input value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} placeholder="Vendor name" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Recorded</option><option>Pending</option><option>Reimbursed</option>
              </select>
            </div>
            <div className="form-group">
              <label>Tax Deductible</label>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                <input
                  type="checkbox"
                  checked={form.is_tax_deductible}
                  onChange={e => setForm({...form, is_tax_deductible: e.target.checked})}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This expense is tax deductible</span>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Expense description..." />
          </div>
        </Modal>
      )}
    </div>
  );
}
