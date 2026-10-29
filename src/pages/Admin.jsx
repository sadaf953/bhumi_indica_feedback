import { useEffect, useMemo, useState } from 'react'
import { QUESTIONS } from '../config/questions.js'
import { supabase, supabaseConfigured } from '../supabase.js'
import Logo from '../components/Logo.jsx'

const RANGES = [
  { id: 'all', label: 'All time', days: null },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '7', label: 'Last 7 days', days: 7 },
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

  if (!supabaseConfigured) return <Shell><p className="lead">Supabase isn’t configured yet. Add the URL and anon key.</p></Shell>
  if (checking) return <Shell><p className="lead">Loading…</p></Shell>
  if (!session) return <Login />
  return <Dashboard session={session} />
}

function Shell({ children, wide = false }) {
  return (
    <main className={'page' + (wide ? ' wide' : '')}>
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

  async function load() {
    setLoading(true); setErr('')
    const { data: me } = await supabase.from('admin_emails').select('email').limit(1)
    if (!me || me.length === 0) { setIsAdmin(false); setLoading(false); return }
    const all = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('feedback')
        .select('id, created_at, answers').order('created_at', { ascending: false }).range(from, from + 999)
      if (error) { setErr(error.message); break }
      all.push(...data)
      if (data.length < 1000) break
    }
    setRows(all); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const r = RANGES.find((x) => x.id === range)
    if (!r.days) return rows
    const since = Date.now() - r.days * 864e5
    return rows.filter((row) => new Date(row.created_at).getTime() >= since)
  }, [rows, range])

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

  const last7 = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 864e5).length

  async function remove(id) {
    if (!window.confirm('Delete this response? This can’t be undone.')) return
    const { error } = await supabase.from('feedback').delete().eq('id', id)
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
            <button className="btn btn-outline" onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>Download CSV</button>
            <button className="btn btn-link" onClick={load}>Refresh</button>
          </div>
        </div>

        {err && <p className="error">{err}</p>}
        {loading ? <p className="lead">Loading responses…</p> : (
          <>
            <div className="stats">
              <Stat label="Responses" value={filtered.length} />
              <Stat label="Last 7 days" value={last7} />
              <Stat label="Total, all time" value={rows.length} />
            </div>

            <div className="charts">
              {QUESTIONS.filter((q) => q.type !== 'text').map((q) => <QuestionChart key={q.id} q={q} rows={filtered} />)}
            </div>

            <h2 className="section-title">All responses</h2>
            {filtered.length === 0 ? <p className="lead">No responses yet.</p> : (
              <div className="responses">
                {filtered.map((r) => (
                  <article className="response" key={r.id}>
                    <div className="response-head">
                      <time>{fmtDate(r.created_at)}</time>
                      <button className="btn btn-link small" onClick={() => remove(r.id)}>Delete</button>
                    </div>
                    {QUESTIONS.map((q) => (
                      <div className="response-row" key={q.id}>
                        <span className="response-q">{q.label}</span>
                        <span className="response-a">{fmtAnswer(r.answers?.[q.id])}</span>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}

function Stat({ label, value }) {
  return <div className="stat"><span className="stat-v">{value}</span><span className="stat-l">{label}</span></div>
}

function QuestionChart({ q, rows }) {
  const opts = q.type === 'rating' ? ['5', '4', '3', '2', '1'] : q.options
  const counts = Object.fromEntries(opts.map((o) => [o, 0]))
  let answered = 0, sum = 0
  for (const r of rows) {
    const v = r.answers?.[q.id]
    if (v === undefined || v === null) continue
    answered++
    if (q.type === 'multi') (Array.isArray(v) ? v : []).forEach((o) => { if (o in counts) counts[o]++ })
    else { const k = String(v); if (k in counts) counts[k]++; if (q.type === 'rating') sum += Number(v) }
  }
  const max = Math.max(1, ...Object.values(counts))
  const denom = Math.max(1, answered)
  return (
    <div className="chart">
      <p className="chart-q">{q.label}</p>
      <p className="chart-sub">
        {answered} answer{answered === 1 ? '' : 's'}
        {q.type === 'rating' && answered > 0 && <> · average <b>{(sum / answered).toFixed(1)}</b> / 5</>}
        {q.type === 'multi' && ' · multiple choice'}
      </p>
      {opts.map((o) => (
        <div className="bar-row" key={o}>
          <span className="bar-label">{q.type === 'rating' ? `${o} ★` : o}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(counts[o] / max) * 100}%` }} /></span>
          <span className="bar-num">{counts[o]} <em>{Math.round((counts[o] / denom) * 100)}%</em></span>
        </div>
      ))}
    </div>
  )
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function fmtAnswer(v) {
  if (v === undefined || v === null || v === '') return '—'
  return Array.isArray(v) ? v.join(', ') : String(v)
}
function downloadCsv(rows) {
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`
  const head = ['Date', ...QUESTIONS.map((q) => q.label)]
  const lines = [head.map(esc).join(',')]
  for (const r of rows) lines.push([fmtDate(r.created_at), ...QUESTIONS.map((q) => fmtAnswer(r.answers?.[q.id]))].map(esc).join(','))
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `bhumi-feedback-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
