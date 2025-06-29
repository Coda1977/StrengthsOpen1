// Temporary override for Replit host blocking issue
process.env.VITE_HOST = "0.0.0.0";
process.env.VITE_ALLOWED_HOSTS = "all";

// Override the allowedHosts check in development
if (process.env.NODE_ENV === 'development') {
  const originalConsoleWarn = console.warn;
  console.warn = function(...args) {
    const message = args.join(' ');
    if (message.includes('allowedHosts') || message.includes('host header')) {
      // Suppress host blocking warnings
      return;
    }
    originalConsoleWarn.apply(console, args);
  };
}

export {};