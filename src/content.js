// All page copy and options in one place. Copy is the client's, with
// "Heartfelt" and "WhatsApp" corrected.

export const BRANDS = ['The Indus Valley', 'Ember Cookware', 'Solara', 'Trilonium', 'None of the above']

export const LINKS = {
  careGuide: 'https://bhumiindica.in/pages/cast-iron-cookware-care-guide',
  email: 'support@bhumiindica.in',
  whatsappLabel: '+91-7678607061',
  whatsappUrl: 'https://wa.me/917678607061',
  site: 'https://bhumiindica.in',
}

export const COPY = {
  greeting: 'Dear Customer',
  gratitude: 'Heartfelt gratitude to you for choosing Bhumi Indica!',
  intro:
    'And congratulations to you for bringing back ancient wisdom to your kitchen. Please answer a couple of questions to help us serve you better.',
  q1: 'Is this your first cast iron cookware purchase?',
  q2: 'Which brand are you currently using?',
  thanksTitle: 'Thank You for answering!',
  detailsTitle: 'A little about you',
  detailsNote: 'We’ll only use these to follow up on your feedback.',

}

// Accepts an Indian mobile (with or without +91 / 0, spaces, dashes) or an email.
// Returns { value, type } normalised, or null if invalid. Same rules are enforced in the database.
export function parseContact(raw) {
  const v = (raw || '').trim()
  if (!v) return null
  if (v.includes('@')) {
    const e = v.toLowerCase()
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120 ? { value: e, type: 'email' } : null
  }
  let d = v.replace(/[\s\-().]/g, '')
  if (d.startsWith('+91')) d = d.slice(3)
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9][0-9]{9}$/.test(d) ? { value: '+91' + d, type: 'phone' } : null
}
