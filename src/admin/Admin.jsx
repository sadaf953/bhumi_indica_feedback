import { useEffect, useMemo, useState } from 'react'
import { BRANDS } from '../content.js'
import { supabase, supabaseConfigured } from '../supabase.js'
import Logo from '../components/Logo.jsx'

const RANGES = [
  { id: 'all', label: 'All time', days: null },
  { id: '30', label: '30 days', days: 30 },
  { id: '7', label: '7 days', days: 7 },
]

export default function Admin() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!supabaseConfigured) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigured) return <Shell><p className="lead">Supabase isn’t configured yet.</p></Shell>
  if (checking) return <Shell><p className="lead">Loading…</p></Shell>
  if (!session) return <Login />
  return <Dashboard session={session} />
}

function Shell({ children }) {
  return (
    <main className="page">
      <header className="topbar"><Logo /></header>
      <section className="card">{children}</section>
    </main>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr('Incorrect email or password.')
  }

  return (
    <Shell>
      <p className="eyebrow">Admin</p>
      <h1>Sign in</h1>
      <span className="rule" />
      <form onSubmit={onSubmit} className="login">
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-solid" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </Shell>
  )
}

function Dashboard({ session }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [isAdmin, setIsAdmin] = useState(true)
  const [range, setRange] = useState('all')
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true); setErr('')
    const { data: me } = await supabase.from('admin_emails').select('email').limit(1)
    if (!me || me.length === 0) { setIsAdmin(false); setLoading(false); return }
    const all = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('responses')
        .select('id, created_at, customer_name, contact, contact_type, first_purchase, current_brand')
        .order('created_at', { ascending: false }).range(from, from + 999)
      if (error) { setErr(error.message); break }
      all.push(...data)
      if (data.length < 1000) break
    }
    setRows(all); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const r = RANGES.find((x) => x.id === range)
    const since = r.days ? Date.now() - r.days * 864e5 : 0
    const needle = q.trim().toLowerCase()
    return rows.filter((row) =>
      new Date(row.created_at).getTime() >= since &&
      (!needle || `${row.customer_name || ''} ${row.contact || ''}`.toLowerCase().includes(needle)))
  }, [rows, range, q])

  const signOut = () => supabase.auth.signOut()

  if (!isAdmin) {
    return (
      <Shell>
        <h1>No access</h1><span className="rule" />
        <p className="lead">{session.user.email} isn’t on the admin list.</p>
        <button className="btn btn-outline" onClick={signOut}>Sign out</button>
      </Shell>
    )
  }

  const total = filtered.length
  const firstTime = filtered.filter((r) => r.first_purchase).length
  const existing = total - firstTime
  const brandCounts = Object.fromEntries(BRANDS.map((b) => [b, 0]))
  filtered.forEach((r) => { if (!r.first_purchase && r.current_brand in brandCounts) brandCounts[r.current_brand]++ })
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)

  async function remove(id) {
    if (!window.confirm('Delete this response? This can’t be undone.')) return
    const { error } = await supabase.from('responses').delete().eq('id', id)
    if (error) alert(error.message); else setRows((r) => r.filter((x) => x.id !== id))
  }

  return (
    <main className="page wide">
      <header className="topbar admin-bar">
        <Logo />
        <div className="admin-actions">
          <span className="who">{session.user.email}</span>
          <button className="btn btn-link" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="card">
        <div className="dash-head">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Customer feedback</h1>
          </div>
          <div className="dash-tools">
            <div className="seg">
              {RANGES.map((r) => (
                <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>{r.label}</button>
              ))}
            </div>
            <button className="btn btn-outline" onClick={() => downloadCsv(filtered)} disabled={!total}>Download CSV</button>
            <button className="btn btn-link" onClick={load}>Refresh</button>
          </div>
        </div>

        {err && <p className="error">{err}</p>}
        {loading ? <p className="lead">Loading responses…</p> : (
          <>
            <div className="stats">
              <Stat label="Responses" value={total} />
              <Stat label="First cast iron purchase" value={firstTime} sub={`${pct(firstTime, total)}%`} />
              <Stat label="Already own cast iron" value={existing} sub={`${pct(existing, total)}%`} />
            </div>

            <div className="charts">
              <div className="chart">
                <p className="chart-q">Is this your first cast iron cookware purchase?</p>
                <p className="chart-sub">{total} answer{total === 1 ? '' : 's'}</p>
                <div className="split" aria-hidden="true">
                  <span className="split-yes" style={{ width: `${pct(firstTime, total)}%` }} />
                  <span className="split-no" style={{ width: `${pct(existing, total)}%` }} />
                </div>
                <Bar label="Yes" n={firstTime} denom={total} max={Math.max(firstTime, existing, 1)} cls="yes" />
                <Bar label="No" n={existing} denom={total} max={Math.max(firstTime, existing, 1)} cls="no" />
              </div>

              <div className="chart">
                <p className="chart-q">Which brand are you currently using?</p>
                <p className="chart-sub">{existing} answer{existing === 1 ? '' : 's'} · from customers who said No</p>
                {BRANDS.map((b) => (
                  <Bar key={b} label={b} n={brandCounts[b]} denom={existing} max={Math.max(1, ...Object.values(brandCounts))} cls="no" />
                ))}
              </div>
            </div>

            <div className="list-head">
              <h2 className="section-title">All responses</h2>
              <input className="search" type="search" placeholder="Search name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {total === 0 ? <p className="lead">No responses yet.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Name</th><th>Phone / email</th><th>First purchase?</th><th>Current brand</th><th /></tr></thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id}>
                        <td>{fmtDate(r.created_at)}</td>
                        <td>{r.customer_name || '—'}</td>
                        <td><ContactLink r={r} /></td>
                        <td><span className={'pill ' + (r.first_purchase ? 'yes' : 'no')}>{r.first_purchase ? 'Yes' : 'No'}</span></td>
                        <td>{r.current_brand || '—'}</td>
                        <td className="right"><button className="btn btn-link small" onClick={() => remove(r.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <span className="stat-v">{value}{sub && <small> {sub}</small>}</span>
      <span className="stat-l">{label}</span>
    </div>
  )
}

function Bar({ label, n, denom, max, cls }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track"><span className={'bar-fill ' + cls} style={{ width: `${(n / max) * 100}%` }} /></span>
      <span className="bar-num">{n} <em>{denom ? Math.round((n / denom) * 100) : 0}%</em></span>
    </div>
  )
}

function ContactLink({ r }) {
  if (!r.contact) return '—'
  if (r.contact_type === 'phone') {
    const digits = r.contact.replace('+', '')
    const shown = r.contact.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2')
    return <a className="contact" href={`https://wa.me/${digits}`} target="_blank" rel="noopener" title="Open WhatsApp chat">{shown}</a>
  }
  return <a className="contact" href={`mailto:${r.contact}`}>{r.contact}</a>
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function downloadCsv(rows) {
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`
  const lines = [['Date', 'Name', 'Phone / email', 'First cast iron purchase', 'Current brand'].map(esc).join(',')]
  for (const r of rows) lines.push([fmtDate(r.created_at), r.customer_name || '', r.contact || '', r.first_purchase ? 'Yes' : 'No', r.current_brand || ''].map(esc).join(','))
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `bhumi-feedback-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
