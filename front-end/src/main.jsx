import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/services/query'
import App from './App.jsx'
import './styles/global.css'
import './styles/public.css'
import './styles/admin.css'
import './styles/pages.css'

const queryClient = createQueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
