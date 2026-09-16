'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import api from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/login', form)
      Cookies.set('token', data.token, { expires: 1 })
      Cookies.set('user', JSON.stringify(data.user), { expires: 1 })
      router.push('/dashboard')
    } catch {
      setError('Email atau password salah')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #EFF4FF 0%, #F0F4FF 50%, #E8F0FE 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Decorative blobs */}
      <div style={{ position: 'fixed', top: '-100px', right: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-100px', left: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {/* Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '40px', boxShadow: '0 20px 60px rgba(15,23,41,0.12), 0 4px 16px rgba(15,23,41,0.06)', border: '1px solid #E2E8F8' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #2563EB, #3B82F6)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(37,99,235,0.3)' }}>☕</div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0F1729', letterSpacing: '-0.5px' }}>Humbl</h1>
            <p style={{ color: '#8896B3', fontSize: '13px', marginTop: '4px' }}>Masuk ke panel admin</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#4A5578', marginBottom: '6px' }}>Email</label>
              <input
                type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@humbl.com"
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E2E8F8', borderRadius: '10px', fontSize: '14px', color: '#0F1729', outline: 'none', background: '#F8FAFF' }}
                onFocus={(e) => e.target.style.borderColor = '#2563EB'}
                onBlur={(e) => e.target.style.borderColor = '#E2E8F8'}
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#4A5578', marginBottom: '6px' }}>Password</label>
              <input
                type="password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E2E8F8', borderRadius: '10px', fontSize: '14px', color: '#0F1729', outline: 'none', background: '#F8FAFF' }}
                onFocus={(e) => e.target.style.borderColor = '#2563EB'}
                onBlur={(e) => e.target.style.borderColor = '#E2E8F8'}
                required
              />
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#EF4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', background: loading ? '#93C5FD' : 'linear-gradient(135deg, #2563EB, #3B82F6)',
              color: '#FFFFFF', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.35)',
            }}>
              {loading ? 'Memverifikasi...' : 'Masuk →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#8896B3', fontSize: '12px', marginTop: '20px' }}>
          Humbl POS System © 2025
        </p>
      </div>
    </div>
  )
}
