import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import FeedbackForm from './pages/FeedbackForm.jsx'
import Admin from './pages/Admin.jsx'
import './styles.css'

// HashRouter (/#/admin) works on GitHub Pages and any static host with no server config.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<FeedbackForm />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<FeedbackForm />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
