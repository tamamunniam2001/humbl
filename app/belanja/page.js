'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';

const fmt = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

export default function BelanjaPage() {
  const [expenseItems, setExpenseItems] = useState([]);
  const [cart, setCart] = useState({});
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [keterangan, setKeterangan] = useState('');
  const [belanjas, setBelanjas] = useState([]);
  const [activeTab, setActiveTab] = useState('new');
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    loadItems();
    loadBelanjas();
  }, []);

  async function loadItems() {
    try {
      const res = await api.get('/admin/expense-items');
      setExpenseItems(res);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadBelanjas() {
    try {
      const res = await api.get('/operational/belanja');
      setBelanjas(res);
    } catch (err) {
      console.error(err);
    }
  }

  const updateCart = (itemId, field, value) => {
    setCart((prev) => ({
      ...prev,
      [itemId]: {
        harga: '',
        qty: 1,
        isi: '',
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const addToCart = (item) => {
    const entry = cart[item.id] || {};
    const harga = Number(entry.harga);
    if (!harga || isNaN(harga) || harga <= 0) return alert('Isi harga terlebih dahulu');
    const isi = Number(entry.isi) || 0;
    const qty = Number(entry.qty) || 1;
    const unitPrice = isi > 0 ? harga / isi : harga;
    const subtotal = unitPrice * qty;

    setCart((prev) => ({
      ...prev,
      [item.id]: {
        ...entry,
        harga: String(harga),
        isi: isi > 0 ? String(isi) : '',
        qty: String(qty),
        added: true,
        subtotal: subtotal.toFixed(2),
        satuan: item.satuan || '',
      },
    }));
  };

  const removeFromCart = (itemId) => {
    const newCart = { ...cart };
    delete newCart[itemId];
    setCart(newCart);
  };

  const cartTotal = () => {
    return Object.keys(cart)
      .filter((k) => cart[k].added)
      .reduce((sum, k) => sum + (Number(cart[k].subtotal) || 0), 0);
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    const items = Object.keys(cart)
      .filter((k) => cart[k].added)
      .map((k) => {
        const item = expenseItems.find((i) => i.id === k);
        const c = cart[k];
        return {
          itemId: k,
          itemName: item?.name || '',
          harga: Number(c.harga) || 0,
          isi: Number(c.isi) || null,
          qty: Number(c.qty) || 1,
          satuan: c.satuan || '',
          keterangan: c.keterangan || '',
          subtotal: Number(c.subtotal) || 0,
          isManual: false,
        };
      });

    if (items.length === 0) return alert('Keranjang kosong');

    try {
      setSaving(true);
      await api.post('/operational/belanja', {
        tanggal,
        keterangan,
        total: cartTotal(),
        items,
      });
      setCart({});
      setKeterangan('');
      setTanggal(new Date().toISOString().split('T')[0]);
      await loadBelanjas();
      alert('Belanja tersimpan sebagai draft');
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSendToAdmin = async (id) => {
    if (!window.confirm('Kirim belanja ini ke admin untuk persetujuan?')) return;
    try {
      setSendingId(id);
      await api.patch(`/operational/belanja/${id}`, { action: 'submit' });
      await loadBelanjas();
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim');
    } finally {
      setSendingId(null);
    }
  };

    const total = cartTotal();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Sidebar />
      <main style={{ padding: '20px', maxWidth: '992px', margin: '0 auto' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab('new')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeTab === 'new' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'new' ? '#fff' : 'var(--muted)',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'new' ? '600' : '400',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            Form Belanja
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeTab === 'history' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'history' ? '#fff' : 'var(--muted)',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'history' ? '600' : '400',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            Riwayat
          </button>
        </div>

        {activeTab === 'new' && (
          <NewBelanjaForm
            tanggal={tanggal}
            setTanggal={setTanggal}
            keterangan={keterangan}
            setKeterangan={setKeterangan}
            expenseItems={expenseItems}
            cart={cart}
            updateCart={updateCart}
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            total={total}
            fmt={fmt}
            saving={saving}
            handleSaveDraft={handleSaveDraft}
          />
        )}

        {activeTab === 'history' && (
          <HistorySection belanjas={belanjas} fmt={fmt} sendingId={sendingId} handleSendToAdmin={handleSendToAdmin} />
        )}
      </main>
    </div>
  );
}