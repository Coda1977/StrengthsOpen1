import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const Logout = () => {
  const [, setLocation] = useLocation();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/logout', {});
    },
    onSuccess: () => {
      console.log('[LOGOUT] Success - redirecting to home');
      window.location.href = '/';
    },
    onError: (error) => {
      console.error('[LOGOUT] Error:', error);
      // Even if logout fails, redirect to home
      window.location.href = '/';
    }
  });

  useEffect(() => {
    console.log('[LOGOUT] Starting logout process');
    logoutMutation.mutate();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Logging out...</p>
      </div>
    </div>
  );
};

export default Logout;