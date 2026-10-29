import { useRef, useState } from 'react'
import { BRANDS, COPY, LINKS } from '../content.js'
import { supabase, supabaseConfigured } from '../supabase.js'
import Logo from '../components/Logo.jsx'

const ERRORS = {
  too_fast: 'That was quick! Please wait a moment and try again.',
  rate_limited: 'We’ve already received a few answers from you. Thank you!',
}

export default function Form() {
  const [step, setStep] = useState('q1') // q1 | q2 | thanks
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const startedAt = useRef(Date.now())
  const honeypot = useRef(null)

  async function save(firstPurchase, brand) {
    setError('')
    if (!supabaseConfigured) { setError('This page isn’t connected yet. Please try again soon.'); return }
    setBusy(true)
    const { error: err } = await supabase.rpc('submit_response', {
      p_first_purchase: firstPurchase,
      p_current_brand: brand,
      p_hp: honeypot.current?.value || '',
      p_elapsed_ms: Date.now() - startedAt.current,
    })
    setBusy(false)
    if (err) {
      const code = Object.keys(ERRORS).find((k) => err.message?.includes(k))
      if (code === 'rate_limited') { setStep('thanks'); return }
      setError(code ? ERRORS[code] : 'Something went wrong. Please try again.')
      setPicked(null)
      return
    }
    setStep('thanks')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function answerQ1(yes) {
    if (busy) return
    setPicked(yes ? 'yes' : 'no')
    if (yes) save(true, null)
    else { setStep('q2'); setPicked(null) }
  }

  function answerQ2(brand) {
    if (busy) return
    setPicked(brand)
    save(false, brand)
  }

  return (
    <main className="page">
      <header className="topbar"><Logo /></header>

      <section className="card" aria-live="polite">
        {step !== 'thanks' && (
          <>
            <p className="eyebrow">{COPY.greeting}</p>
            <h1>{COPY.gratitude}</h1>
            <span className="rule" />
            <p className="lead">{COPY.intro}</p>
          </>
        )}

        {step === 'q1' && (
          <fieldset className="question">
            <legend><span className="qnum">01</span>{COPY.q1}</legend>
            <div className="options two">
              {[['yes', 'Yes'], ['no', 'No']].map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={picked === k}
                  className={'option' + (picked === k ? ' on' : '')} disabled={busy}
                  onClick={() => answerQ1(k === 'yes')}>
                  <span className="tick" aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 'q2' && (
          <fieldset className="question">
            <legend><span className="qnum">02</span>{COPY.q2}</legend>
            <div className="options">
              {BRANDS.map((b) => (
                <button key={b} type="button" role="radio" aria-checked={picked === b}
                  className={'option' + (picked === b ? ' on' : '')} disabled={busy}
                  onClick={() => answerQ2(b)}>
                  <span className="tick" aria-hidden="true" />{b}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-link back" disabled={busy}
              onClick={() => { setStep('q1'); setPicked(null); setError('') }}>← Back</button>
          </fieldset>
        )}

        {step === 'thanks' && (
          <div className="thanks">
            <p className="eyebrow">{COPY.greeting}</p>
            <h1>{COPY.thanksTitle}</h1>
            <span className="rule" />
            <p className="lead">
              For any questions regarding usage, maintenance, seasoning and rust removal please have a look at
              our <a href={LINKS.careGuide}>care guide</a>.
            </p>
            <p className="lead">
              For anything else please feel free to reach out to us at{' '}
              <a href={`mailto:${LINKS.email}`}>{LINKS.email}</a> or WhatsApp us at{' '}
              <a href={LINKS.whatsappUrl} target="_blank" rel="noopener">{LINKS.whatsappLabel}</a>.
            </p>
            <div className="thanks-actions">
              <a className="btn btn-solid" href={LINKS.careGuide}>View care guide</a>
              <a className="btn btn-outline" href={LINKS.whatsappUrl} target="_blank" rel="noopener">WhatsApp us</a>
            </div>
          </div>
        )}

        {/* honeypot — hidden from people; bots fill it */}
        <div className="hp" aria-hidden="true">
          <label>Leave empty<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>

        {busy && <p className="hint">Saving…</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <footer className="foot">
        <span>Ancient wisdom for modern kitchen.</span>
        <a href={LINKS.site}>bhumiindica.in</a>
      </footer>
    </main>
  )
}
