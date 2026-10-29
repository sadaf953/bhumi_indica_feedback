import logo from '../logo.png'
import { LINKS } from '../content.js'

// Terracotta logo + wordmark, top-left corner, always on the pale background.
export default function Logo() {
  return (
    <a href={LINKS.site} className="logo" aria-label="Bhumi Indica home">
      <img src={logo} alt="Bhumi Indica" />
    </a>
  )
}
