import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App'
import './styles.css'
import './tablet-input-contract.css'
import { installLocalApi } from './lib/localApi'
import { ThemeProvider } from 'next-themes'
import { ensureDailyLocalArchive } from './lib/services/archiveService'
import { NumericPadProvider } from './components/numeric-pad'

// Capacitor is intentionally imported only for native lifecycle compatibility.
// The POS remains fully functional in the browser/PWA runtime as well.

installLocalApi()
void ensureDailyLocalArchive().catch(() => undefined)
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="tayba-theme">
      <QueryClientProvider client={queryClient}>
        <App />
        <NumericPadProvider />
        <Toaster position="top-center" richColors />
          </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
