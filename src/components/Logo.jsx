export default function Logo({ small = false }) {
  return (
    <a href="https://bhumiindica.in" className={'logo' + (small ? ' small' : '')} aria-label="Bhumi Indica home">
      <img src="./logo.png" alt="Bhumi Indica" />
    </a>
  )
}
