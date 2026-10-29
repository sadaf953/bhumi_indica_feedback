import { useRef, useState } from 'react'
import { FORM, QUESTIONS } from '../config/questions.js'
import { supabase, supabaseConfigured } from '../supabase.js'
import Logo from '../components/Logo.jsx'

const ERRORS = {
  too_fast: 'That was quick! Please take a moment and try again.',
  rate_limited: 'We’ve received a few responses from you already. Please try again later.',
  empty: 'Please answer at least one question.',
  too_long: 'Your answer is a little too long. Please shorten it.',
}

function isAnswered(q, v) {
  if (q.type === 'multi') return Array.isArray(v) && v.length > 0
  if (q.type === 'text') return typeof v === 'string' && v.trim().length > 0
  return v !== undefined && v !== null && v !== ''
}

export default function FeedbackForm() {
  const [answers, setAnswers] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | done
  const [error, setError] = useState('')
  const startedAt = useRef(Date.now())
  const honeypot = useRef(null)

  const set = (id, value) => setAnswers((a) => ({ ...a, [id]: value }))
  const toggle = (id, opt) =>
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? a[id] : []
      return { ...a, [id]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt] }
    })

  const missing = QUESTIONS.filter((q) => q.required && !isAnswered(q, answers[q.id]))
  const canSubmit = missing.length === 0 && status !== 'sending'

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!canSubmit) {
      setError('Please answer the required question' + (missing.length > 1 ? 's.' : '.'))
      return
    }
    if (!supabaseConfigured) {
      setError('The form isn’t connected yet. Please try again soon.')
      return
    }
    // keep only answered questions, trimmed
    const payload = {}
    for (const q of QUESTIONS) {
      const v = answers[q.id]
      if (!isAnswered(q, v)) continue
      payload[q.id] = q.type === 'text' ? v.trim().slice(0, q.maxLength || 1000) : v
    }
    setStatus('sending')
    const { error: err } = await supabase.rpc('submit_feedback', {
      p_answers: payload,
      p_hp: honeypot.current?.value || '',
      p_elapsed_ms: Date.now() - startedAt.current,
    })
    if (err) {
      const code = Object.keys(ERRORS).find((k) => err.message?.includes(k))
      setError(code ? ERRORS[code] : 'Something went wrong. Please try again.')
      setStatus('idle')
      return
    }
    setStatus('done')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (status === 'done') {
    return (
      <main className="page">
        <header className="topbar"><Logo /></header>
        <section className="card thanks">
          <p className="eyebrow">{FORM.eyebrow}</p>
          <h1>{FORM.thanksTitle}</h1>
          <span className="rule" />
          <p className="lead">{FORM.thanksText}</p>
          <a className="btn btn-outline" href="https://bhumiindica.in">Visit Bhumi Indica</a>
        </section>
        <Footer />
      </main>
    )
  }

  return (
    <main className="page">
      <header className="topbar"><Logo /></header>

      <form className="card" onSubmit={onSubmit} noValidate>
        <p className="eyebrow">{FORM.eyebrow}</p>
        <h1>{FORM.title}</h1>
        <span className="rule" />
        <p className="lead">{FORM.intro}</p>

        {QUESTIONS.map((q, i) => (
          <fieldset className="question" key={q.id}>
            <legend>
              <span className="qnum">{String(i + 1).padStart(2, '0')}</span>
              {q.label}
              {!q.required && <span className="optional"> (optional)</span>}
            </legend>

            {q.type === 'rating' && (
              <div className="scale" role="radiogroup" aria-label={q.label}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} role="radio" aria-checked={answers[q.id] === n}
                    className={'scale-btn' + (answers[q.id] === n ? ' on' : '')}
                    onClick={() => set(q.id, n)}>{n}</button>
                ))}
                <div className="scale-ends"><span>{q.minLabel || 'Not great'}</span><span>{q.maxLabel || 'Loved it'}</span></div>
              </div>
            )}

            {(q.type === 'single' || q.type === 'multi') && (
              <div className="options" role={q.type === 'single' ? 'radiogroup' : 'group'} aria-label={q.label}>
                {q.options.map((opt) => {
                  const on = q.type === 'single' ? answers[q.id] === opt : (answers[q.id] || []).includes(opt)
                  return (
                    <button type="button" key={opt}
                      role={q.type === 'single' ? 'radio' : 'checkbox'} aria-checked={on}
                      className={'option' + (on ? ' on' : '')}
                      onClick={() => (q.type === 'single' ? set(q.id, opt) : toggle(q.id, opt))}>
                      <span className="tick" aria-hidden="true" />{opt}
                    </button>
                  )
                })}
                {q.type === 'multi' && <p className="hint">Choose all that apply</p>}
              </div>
            )}

            {q.type === 'text' && (
              <>
                <textarea rows={4} maxLength={q.maxLength || 1000} placeholder={q.placeholder || ''}
                  value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} />
                <p className="hint right">{(answers[q.id] || '').length}/{q.maxLength || 1000}</p>
              </>
            )}
          </fieldset>
        ))}

        {/* honeypot — hidden from people, bots fill it */}
        <div className="hp" aria-hidden="true">
          <label>Leave this empty<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <button className="btn btn-solid" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : FORM.submitLabel}
        </button>
        <p className="hint center">We don’t collect your name, email or phone number.</p>
      </form>
      <Footer />
    </main>
  )
}

function Footer() {
  return (
    <footer className="foot">
      <span>Ancient wisdom for modern kitchen.</span>
      <a href="https://bhumiindica.in">bhumiindica.in</a>
    </footer>
  )
}
