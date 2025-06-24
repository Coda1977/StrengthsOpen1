import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Conversation, Message, ConversationBackup } from '@shared/schema';

interface ConversationWithMessages {
  conversation: Conversation;
  messages: Message[];
}

interface CreateConversationData {
  title: string;
  mode: 'personal' | 'team';
  metadata?: any;
}

interface CreateMessageData {
  content: string;
  type: 'user' | 'ai';
  metadata?: any;
}

interface MigrationResult {
  success: boolean;
  conversationsCreated: number;
  messagesCreated: number;
  error?: string;
}

// Hook for managing conversations
export function useConversations() {
  const queryClient = useQueryClient();

  // Get all conversations
  const conversationsQuery = useQuery({
    queryKey: ['/api/conversations'],
    queryFn: async (): Promise<Conversation[]> => {
      const response = await fetch('/api/conversations', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      const data = await response.json();
      return data.data;
    }
  });

  // Get specific conversation with messages
  const getConversation = (conversationId: string) => {
    return useQuery({
      queryKey: ['/api/conversations', conversationId],
      queryFn: async (): Promise<ConversationWithMessages> => {
        const response = await fetch(`/api/conversations/${conversationId}`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch conversation');
        }
        const data = await response.json();
        return data.data;
      },
      enabled: !!conversationId
    });
  };

  // Create conversation
  const createConversationMutation = useMutation({
    mutationFn: async (data: CreateConversationData): Promise<Conversation> => {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  // Update conversation
  const updateConversationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateConversationData> }): Promise<Conversation> => {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update conversation');
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', id] });
    },
  });

  // Delete conversation
  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  // Archive conversation
  const archiveConversationMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/conversations/${id}/archive`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to archive conversation');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  // Add message to conversation
  const addMessageMutation = useMutation({
    mutationFn: async ({ conversationId, data }: { conversationId: string; data: CreateMessageData }): Promise<Message> => {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to add message');
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] }); // Update last activity
    },
  });

  return {
    conversations: conversationsQuery.data || [],
    isLoading: conversationsQuery.isLoading,
    error: conversationsQuery.error,
    getConversation,
    createConversation: createConversationMutation.mutateAsync,
    updateConversation: updateConversationMutation.mutateAsync,
    deleteConversation: deleteConversationMutation.mutateAsync,
    archiveConversation: archiveConversationMutation.mutateAsync,
    addMessage: addMessageMutation.mutateAsync,
    isCreating: createConversationMutation.isPending,
    isUpdating: updateConversationMutation.isPending,
    isDeleting: deleteConversationMutation.isPending,
    isAddingMessage: addMessageMutation.isPending,
  };
}

// Hook for migration and backup operations
export function useMigration() {
  const queryClient = useQueryClient();

  // Migrate from localStorage
  const migrateMutation = useMutation({
    mutationFn: async (localStorageData: string): Promise<MigrationResult> => {
      const response = await fetch('/api/conversations/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ localStorageData }),
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Migration failed');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  // Export conversations
  const exportQuery = useQuery({
    queryKey: ['/api/conversations/export'],
    queryFn: async () => {
      const response = await fetch('/api/conversations/export', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to export conversations');
      }
      const data = await response.json();
      return data.data;
    },
    enabled: false, // Only run when explicitly requested
  });

  // Get backups
  const backupsQuery = useQuery({
    queryKey: ['/api/conversations/backups'],
    queryFn: async (): Promise<ConversationBackup[]> => {
      const response = await fetch('/api/conversations/backups', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch backups');
      }
      const data = await response.json();
      return data.data;
    }
  });

  // Restore from backup
  const restoreMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const response = await fetch(`/api/conversations/restore/${backupId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to restore backup');
      }
      const data = await response.json();
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  // Handle corrupted localStorage
  const recoverMutation = useMutation({
    mutationFn: async (partialData?: string) => {
      const response = await fetch('/api/conversations/recover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ partialData }),
      });
      if (!response.ok) {
        throw new Error('Failed to recover data');
      }
      const data = await response.json();
      return data.data;
    },
  });

  return {
    migrate: migrateMutation.mutateAsync,
    exportConversations: () => exportQuery.refetch(),
    backups: backupsQuery.data || [],
    restore: restoreMutation.mutateAsync,
    recover: recoverMutation.mutateAsync,
    isMigrating: migrateMutation.isPending,
    isExporting: exportQuery.isFetching,
    isRestoring: restoreMutation.isPending,
    isRecovering: recoverMutation.isPending,
    exportData: exportQuery.data,
    backupsLoading: backupsQuery.isLoading,
  };
}