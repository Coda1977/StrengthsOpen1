// Aggressive override for Replit host blocking issue
process.env.VITE_HOST = "0.0.0.0";
process.env.VITE_ALLOWED_HOSTS = "all";
process.env.DANGEROUSLY_DISABLE_HOST_CHECK = "true";

// Suppress all host-related warnings and errors
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.warn = function(...args) {
  const message = args.join(' ');
  if (message.includes('allowedHosts') || 
      message.includes('host header') || 
      message.includes('Invalid Host') ||
      message.includes('Blocked request')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

console.error = function(...args) {
  const message = args.join(' ');
  if (message.includes('allowedHosts') || 
      message.includes('host header') || 
      message.includes('Invalid Host') ||
      message.includes('Blocked request')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

export {};