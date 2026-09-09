/**
 * Ponto de entrada do bundle. Importa `lib/tema` ANTES de montar o React: o tema salvo precisa
 * estar aplicado no <html> antes da primeira pintura, senão a página pisca no tema errado.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/tema' // aplica o tema salvo antes de montar
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
