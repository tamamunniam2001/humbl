'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';

export default function PantauSaldoPage() {
  const [saldo, setSaldo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [nominal, setNominal] = useState('');
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    loadSaldo();
  }, []);

  async function loadSaldo() {
    try {
      const res = await api.get('/operational/saldo');
      setSaldo(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleIsiSaldo(e) {
    e.preventDefault();
    try {
      await api.post('/operational/saldo', { amount: Number(nominal), note: catatan });
      setShowModal(false);
      setNominal('');
      setCatatan('');
      await loadSaldo();
      alert('Saldo berhasil diisi');
    } catch (err) {
      console.error(err);
      alert('Gagal mengisi saldo');
    }
  }

  const fmt = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Sidebar />
      <main style={{ padding: '20px', maxWidth: '768px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '20px' }}>Pantau Saldo Operasional</h1>

        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Saldo Saat Ini</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>{fmt(saldo?.balance)}</div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{ padding: '12px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}
        >
          + Isi Saldo
        </button>

                {showModal && <SaldoModal setShowModal={setShowModal} nominal={nominal} setNominal={setNominal} catatan={catatan} setCatatan={setCatatan} handleIsiSaldo={handleIsiSaldo} />}

        {saldo?.history?.length > 0 && <SaldoHistory history={saldo.history} fmt={fmt} />}
      </main>
    </div>
  );
}

function SaldoModal({ setShowModal, nominal, setNominal, catatan, setCatatan, handleIsiSaldo }) {
  return (
    <div style={{ position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>Isi Saldo Operasional</h2>
        <form onSubmit={(e) => { handleIsiSaldo(e); setShowModal(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Nominal</label>
            <input
              type="number"
              step="any"
              min="1"
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Catatan</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Opsional..."
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', resize: 'vertical', minHeight: '80px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              style={{ flex: 1, padding: '12px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              Batal
            </button>
            <button
              type="submit"
              style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}
            >
              Isi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SaldoHistory({ history, fmt }) {
  return (
    <div style={{ marginTop: '24px' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>Riwayat Transaksi</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {history.map((tx) => (
          <div key={tx.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{tx.note || tx.type}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{new Date(tx.createdAt).toLocaleDateString('id-ID')}</div>
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: tx.type === 'RESTOCK' || tx.type === 'ADJUST' ? '#16a34a' : '#ef4444' }}>{fmt(tx.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}