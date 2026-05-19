import React, { useState } from 'react';
import BookingCalendar from '../components/BookingCalendar';
import GalleryViewer from '../components/GalleryViewer';
import InvoicePDF from '../components/InvoicePDF';
import PhotoSelectionWorkflow from '../components/PhotoSelectionWorkflow';

const tabs = [
  { key: 'calendar',  label: 'Booking Calendar',     kind: 'VIZ' },
  { key: 'gallery',   label: 'Gallery Viewer',       kind: 'VIZ' },
  { key: 'invoice',   label: 'Invoice PDF',          kind: 'NON-VIZ' },
  { key: 'selection', label: 'Photo Selection Flow', kind: 'NON-VIZ' }
];

export default function CustomViewsPage({ token }) {
  const [active, setActive] = useState('calendar');
  const t = token || localStorage.getItem('token');

  return (
    <div data-testid="custom-views-page" style={{ padding: 24, color: '#e2e8f0', minHeight: '100%' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, color: '#f1f5f9' }}>Studio Views</h2>
        <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
          Custom calendar, gallery, invoice, and proofing workflows for the studio.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            style={{
              background: active === tab.key ? '#5f27cd' : '#1e293b',
              color: '#fff',
              border: '1px solid ' + (active === tab.key ? '#5f27cd' : '#334155'),
              borderRadius: 8,
              padding: '8px 14px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13
            }}
          >
            <span style={{ marginRight: 6, fontSize: 10, opacity: 0.75 }}>{tab.kind}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {active === 'calendar'  && <BookingCalendar token={t} />}
        {active === 'gallery'   && <GalleryViewer token={t} />}
        {active === 'invoice'   && <InvoicePDF token={t} />}
        {active === 'selection' && <PhotoSelectionWorkflow token={t} />}
      </div>
    </div>
  );
}
