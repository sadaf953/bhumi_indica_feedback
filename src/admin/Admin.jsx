import { useEffect, useMemo, useState } from 'react'
import { BRANDS } from '../content.js'
import { supabase, supabaseConfigured } from '../supabase.js'
import Logo from '../components/Logo.jsx'

// Read before supabase-js clears the URL: did we arrive from a reset-password or invite email?
const ARRIVED_FROM_INVITE = /type=invite/.test(window.location.hash)
const ARRIVED_FROM_RESET = ARRIVED_FROM_INVITE || /type=recovery/.test(window.location.hash)
const RESET_LINK_ERROR = /error_code=otp_expired|error=access_denied/.test(window.location.hash)
const MIN_PASSWORD = 8

const RANGES = [
  { id: 'all', label: 'All time', days: null },
  { id: '30', label: '30 days', days: 30 },
  { id: '7', label: '7 days', days: 7 },
]

export default function Admin() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [recovery, setRecovery] = useState(ARRIVED_FROM_RESET)

  useEffect(() => {
    if (!supabaseConfigured) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigured) return <Shell><p className="lead">Supabase isn’t configured yet.</p></Shell>
  if (checking) return <Shell><p className="lead">Loading…</p></Shell>
  if (!session) return <Login linkExpired={RESET_LINK_ERROR} />
  if (recovery) {
    return (
      <Shell>
        <SetPassword
          title={ARRIVED_FROM_INVITE ? 'Welcome! Set your password' : 'Set a new password'}
          intro={ARRIVED_FROM_INVITE ? `Choose the password you’ll use to sign in as ${session.user.email}.` : `For ${session.user.email}`}
          onDone={() => { setRecovery(false); history.replaceState(null, '', window.location.pathname) }} />
      </Shell>
    )
  }
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

function Login({ linkExpired }) {
  const [mode, setMode] = useState('signin') // signin | forgot | sent
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(linkExpired ? 'That link has expired or was already used. Use “Forgot password?” below to get a new one.' : '')
  const [busy, setBusy] = useState(false)

  async function onSignIn(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr('Incorrect email or password.')
  }

  async function onForgot(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + window.location.pathname,
    })
    setBusy(false)
    if (error && /rate|seconds/i.test(error.message)) { setErr('Too many requests. Please wait a few minutes and try again.'); return }
    setMode('sent') // same message whether or not the email exists
  }

  if (mode === 'sent') {
    return (
      <Shell>
        <p className="eyebrow">Admin</p>
        <h1>Check your email</h1>
        <span className="rule" />
        <p className="lead">If <b>{email.trim()}</b> has an admin account, a link to set a new password is on its way. It can take a minute; check spam too.</p>
        <button className="btn btn-link back" onClick={() => setMode('signin')}>← Back to sign in</button>
      </Shell>
    )
  }

  if (mode === 'forgot') {
    return (
      <Shell>
        <p className="eyebrow">Admin</p>
        <h1>Forgot password</h1>
        <span className="rule" />
        <p className="lead">Enter your admin email and we’ll send you a link to set a new password.</p>
        <form onSubmit={onForgot} className="login">
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-solid" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
        <button className="btn btn-link back" onClick={() => { setMode('signin'); setErr('') }}>← Back to sign in</button>
      </Shell>
    )
  }

  return (
    <Shell>
      <p className="eyebrow">Admin</p>
      <h1>Sign in</h1>
      <span className="rule" />
      <form onSubmit={onSignIn} className="login">
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-solid" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <button className="btn btn-link back" onClick={() => { setMode('forgot'); setErr('') }}>Forgot password?</button>
    </Shell>
  )
}

function SetPassword({ title, intro, onDone, onCancel }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    if (pw.length < MIN_PASSWORD) { setErr(`Use at least ${MIN_PASSWORD} characters.`); return }
    if (pw !== pw2) { setErr('The two passwords don’t match.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) {
      setErr(/different from the old/i.test(error.message) ? 'That’s your current password. Choose a new one.'
        : /reauth|recent/i.test(error.message) ? 'For security, please sign out, sign in again and retry.'
        : error.message)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <>
        <p className="eyebrow">Admin</p>
        <h1>Password updated</h1>
        <span className="rule" />
        <p className="lead">Use your new password next time you sign in.</p>
        <button className="btn btn-solid" onClick={onDone}>Go to dashboard</button>
      </>
    )
  }

  return (
    <>
      <p className="eyebrow">Admin</p>
      <h1>{title}</h1>
      <span className="rule" />
      {intro && <p className="lead">{intro}</p>}
      <form onSubmit={onSubmit} className="login">
        <label>New password<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></label>
        <p className="hint">At least {MIN_PASSWORD} characters.</p>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-solid" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
      {onCancel && <button className="btn btn-link back" onClick={onCancel}>← Back to dashboard</button>}
    </>
  )
}

function Dashboard({ session }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [isAdmin, setIsAdmin] = useState(true)
  const [range, setRange] = useState('all')
  const [q, setQ] = useState('')
  const [changingPw, setChangingPw] = useState(false)

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

  if (changingPw) {
    return (
      <Shell>
        <SetPassword title="Change password" intro={session.user.email}
          onDone={() => setChangingPw(false)} onCancel={() => setChangingPw(false)} />
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
          <button className="btn btn-link" onClick={() => setChangingPw(true)}>Change password</button>
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
