import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Form from './Form.jsx'
import '../styles.css'

createRoot(document.getElementById('root')).render(<StrictMode><Form /></StrictMode>)
