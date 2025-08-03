import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const Logout = () => {
  const { logout } = useAuth();

  useEffect(() => {
    console.log('[LOGOUT] Starting logout process with Clerk');
    // Use the Clerk logout function which handles everything
    logout();
  }, [logout]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Signing out...</p>
      </div>
    </div>
  );
};

export default Logout;