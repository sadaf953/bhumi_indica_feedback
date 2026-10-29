import { useRef, useState } from 'react'
import { BRANDS, COPY, LINKS } from '../content.js'
import { supabase, supabaseConfigured } from '../supabase.js'
import logo from '../logo.png'
import './form.css'

const ERRORS = {
  too_fast: 'That was quick! Please wait a moment and try again.',
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
    if (!supabaseConfigured) { setError('This page isn’t connected yet. Please try again soon.'); setPicked(null); return }
    setBusy(true)
    const { error: err } = await supabase.rpc('submit_response', {
      p_first_purchase: firstPurchase,
      p_current_brand: brand,
      p_hp: honeypot.current?.value || '',
      p_elapsed_ms: Date.now() - startedAt.current,
    })
    setBusy(false)
    if (err && !err.message?.includes('rate_limited')) {
      const code = Object.keys(ERRORS).find((k) => err.message?.includes(k))
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
    if (yes) { save(true, null); return }
    // short pause so the tap registers visually, then reveal Q2
    setTimeout(() => { setStep('q2'); setPicked(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }, 220)
  }

  function answerQ2(brand) {
    if (busy) return
    setPicked(brand)
    save(false, brand)
  }

  return (
    <div className="fb">
      {/* same header pattern as bhumiindica.in: announcement bar + centred logo */}
      <div className="fb-announce">Ancient wisdom for modern kitchen</div>
      <header className="fb-head">
        <a href={LINKS.site} className="fb-logo" aria-label="Bhumi Indica home">
          <img src={logo} alt="Bhumi Indica" />
        </a>
        <a href={LINKS.site} className="fb-shop" aria-label="Visit the Bhumi Indica store">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 8.5h15l-1 12h-13z" /><path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5" /></svg>
        </a>
      </header>

      <main className="fb-main" aria-live="polite">
        {step !== 'thanks' ? (
          <>
            <section className="fb-hero">
              <p className="fb-eyebrow">{COPY.greeting}</p>
              <h1 className="fb-title">
                Heartfelt gratitude to you for choosing <span className="terra">Bhumi&nbsp;Indica!</span>
              </h1>
              <p className="fb-intro">{COPY.intro}</p>
            </section>

            <div className="fb-progress" aria-label={`Question ${step === 'q1' ? 1 : 2}`}>
              <span className="fb-step-label">Question {step === 'q1' ? '1' : '2'}</span>
              <span className="fb-bars"><i className="on" /><i className={step === 'q2' ? 'on' : ''} /></span>
            </div>

            <section className="fb-card" key={step}>
              {step === 'q1' && (
                <fieldset>
                  <legend className="fb-q">{COPY.q1}</legend>
                  <div className="fb-yesno" role="radiogroup">
                    {[['yes', 'Yes'], ['no', 'No']].map(([k, label]) => (
                      <button key={k} type="button" role="radio" aria-checked={picked === k}
                        className={'fb-choice big' + (picked === k ? ' on' : '')} disabled={busy}
                        onClick={() => answerQ1(k === 'yes')}>
                        <span className="fb-radio" aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {step === 'q2' && (
                <fieldset>
                  <legend className="fb-q">{COPY.q2}</legend>
                  <div className="fb-list" role="radiogroup">
                    {BRANDS.map((b) => (
                      <button key={b} type="button" role="radio" aria-checked={picked === b}
                        className={'fb-choice' + (picked === b ? ' on' : '')} disabled={busy}
                        onClick={() => answerQ2(b)}>
                        <span>{b}</span>
                        <span className="fb-radio" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  <button type="button" className="fb-back" disabled={busy}
                    onClick={() => { setStep('q1'); setPicked(null); setError('') }}>
                    ← Back
                  </button>
                </fieldset>
              )}

              {busy && <p className="fb-status">Saving…</p>}
              {error && <p className="fb-error" role="alert">{error}</p>}
            </section>
          </>
        ) : (
          <section className="fb-thanks">
            <svg className="fb-check" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="30" />
              <path d="M20 33 l8 8 l16 -18" />
            </svg>
            <p className="fb-eyebrow">{COPY.greeting}</p>
            <h1 className="fb-title">{COPY.thanksTitle}</h1>
            <p className="fb-intro">
              For any questions regarding usage, maintenance, seasoning and rust removal please have a look at
              our <a href={LINKS.careGuide}>care guide</a>.
            </p>
            <p className="fb-intro">
              For anything else please feel free to reach out to us at{' '}
              <a href={`mailto:${LINKS.email}`}>{LINKS.email}</a> or WhatsApp us
              at <a href={LINKS.whatsappUrl} target="_blank" rel="noopener">{LINKS.whatsappLabel}</a>.
            </p>

            <div className="fb-actions">
              <a className="fb-btn solid" href={LINKS.careGuide}>View care guide</a>
              <div className="fb-actions-row">
                <a className="fb-btn" href={LINKS.whatsappUrl} target="_blank" rel="noopener">WhatsApp</a>
                <a className="fb-btn" href={`mailto:${LINKS.email}`}>Email us</a>
              </div>
            </div>
          </section>
        )}

        {/* honeypot — hidden from people; bots fill it */}
        <div className="fb-hp" aria-hidden="true">
          <label>Leave empty<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
      </main>

      <footer className="fb-foot">
        <p>© Bhumi Indica</p>
        <a href={LINKS.site}>bhumiindica.in</a>
      </footer>
    </div>
  )
}
