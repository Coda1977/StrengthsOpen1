import React from 'react';
import { ClerkProvider as BaseClerkProvider } from '@clerk/nextjs';

interface ClerkProviderProps {
  children: React.ReactNode;
}

export function ClerkProvider({ children }: ClerkProviderProps) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error('Missing Clerk Publishable Key');
  }

  return (
    <BaseClerkProvider 
      publishableKey={publishableKey}
      appearance={{
        baseTheme: undefined, // Use default theme, or customize as needed
        variables: {
          colorPrimary: '#000000',
        },
        elements: {
          formButtonPrimary: 'bg-black hover:bg-gray-800 text-white',
          card: 'shadow-lg',
        },
      }}
    >
      {children}
    </BaseClerkProvider>
  );
}

export default ClerkProvider;