import { StrictMode } from 'react'
  import { createRoot } from 'react-dom/client'
  import './index.css'
  import App from './App.tsx'
  import { ClerkProvider } from '@clerk/clerk-react'
  import { PostHogProvider } from 'posthog-js/react'

  // Import your Publishable Key
  const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  if (!PUBLISHABLE_KEY) {
    throw new Error('Add your Clerk Publishable Key to the .env file')
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PostHogProvider
        apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
        options={{
          api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
          defaults: '2025-05-24',
          capture_exceptions: true,
          debug: import.meta.env.MODE === "development",
        }}
      >
        <ClerkProvider
          publishableKey={PUBLISHABLE_KEY}
          appearance={{
            elements: {
              rootBox: "display: none",
              card: "display: none"
            }
          }}
          signInForceRedirectUrl="/"
          signUpForceRedirectUrl="/"
        >
          <App />
        </ClerkProvider>
      </PostHogProvider>
    </StrictMode>,
  )