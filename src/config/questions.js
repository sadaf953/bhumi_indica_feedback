// ──────────────────────────────────────────────────────────────────────────
//  THE ONLY FILE TO EDIT TO CHANGE THE QUESTIONS.
//
//  type:
//    'rating'  – 1 to 5 tap scale            (charted on the dashboard)
//    'single'  – pick one option             (charted on the dashboard)
//    'multi'   – pick any number of options  (charted on the dashboard)
//    'text'    – free answer                 (listed on the dashboard)
//
//  Keep each `id` stable once the form is live — it's how answers are stored.
//  PLACEHOLDER questions below: replace with the client's final wording.
// ──────────────────────────────────────────────────────────────────────────

export const FORM = {
  eyebrow: 'Your feedback',
  title: 'Tell us how we’re doing',
  intro: 'It takes less than a minute, and it’s completely anonymous.',
  submitLabel: 'Submit feedback',
  thanksTitle: 'Thank you',
  thanksText: 'Your feedback helps us make cookware that lasts generations.',
}

export const QUESTIONS = [
  {
    id: 'q1',
    type: 'single',
    label: 'How would you rate your overall experience with Bhumi Indica?',
    required: true,
    options: ['Excellent', 'Good', 'Average', 'Poor'],
  },
  {
    id: 'q2',
    type: 'text',
    label: 'Anything you’d like to tell us?',
    placeholder: 'Your thoughts…',
    required: false,
    maxLength: 1000,
  },
]
