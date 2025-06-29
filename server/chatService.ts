import { storage } from './storage';
import type { Conversation, Message } from '@shared/schema';

export interface ChatMigrationData {
  conversations: Array<{
    id: string;
    title: string;
    mode: 'personal' | 'team';
    messages: Array<{
      id: string;
      content: string;
      type: 'user' | 'ai';
      timestamp: Date;
    }>;
    lastActivity: Date;
  }>;
}

export class ChatService {
  // Migrate from localStorage to database
  async migrateFromLocalStorage(userId: string, localStorageData: string): Promise<{ success: boolean; conversationsCreated: number; messagesCreated: number; error?: string }> {
    try {
      // Parse localStorage data
      let chatHistory: any[];
      try {
        chatHistory = JSON.parse(localStorageData);
      } catch (parseError) {
        if (process.env.NODE_ENV !== 'production') console.error('Failed to parse localStorage data:', parseError);
        return { success: false, conversationsCreated: 0, messagesCreated: 0, error: 'Invalid localStorage data format' };
      }

      if (!Array.isArray(chatHistory)) {
        return { success: false, conversationsCreated: 0, messagesCreated: 0, error: 'localStorage data is not an array' };
      }

      // Create backup before migration
      await storage.createConversationBackup(userId, {
        backupData: chatHistory,
        source: 'localStorage'
      });

      let conversationsCreated = 0;
      let messagesCreated = 0;

      // Migrate each conversation
      for (const chatData of chatHistory) {
        if (!chatData.title || !chatData.messages || !Array.isArray(chatData.messages)) {
          if (process.env.NODE_ENV !== 'production') console.warn('Skipping invalid conversation data:', chatData);
          continue;
        }

        // Create conversation
        const conversation = await storage.createConversation(userId, {
          title: chatData.title,
          mode: chatData.mode || 'personal',
          metadata: { 
            migratedFrom: 'localStorage',
            originalId: chatData.id,
            originalLastActivity: chatData.lastActivity 
          }
        });

        conversationsCreated++;

        // Create messages
        for (const messageData of chatData.messages) {
          if (!messageData.content || !messageData.type) {
            if (process.env.NODE_ENV !== 'production') console.warn('Skipping invalid message data:', messageData);
            continue;
          }

          await storage.createMessage({
            conversationId: conversation.id,
            content: messageData.content,
            type: messageData.type,
            metadata: { 
              originalId: messageData.id,
              originalTimestamp: messageData.timestamp 
            }
          });

          messagesCreated++;
        }

        // Update conversation last activity if provided
        if (chatData.lastActivity) {
          await storage.updateConversation(conversation.id, userId, {
            lastActivity: new Date(chatData.lastActivity)
          });
        }
      }

      return { success: true, conversationsCreated, messagesCreated };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Migration failed:', error);
      return { success: false, conversationsCreated: 0, messagesCreated: 0, error: 'Migration failed: ' + (error as Error).message };
    }
  }

  // Check if user has any conversations (to determine if migration is needed)
  async hasExistingConversations(userId: string): Promise<boolean> {
    try {
      const conversations = await storage.getConversations(userId);
      return conversations.length > 0;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error checking existing conversations:', error);
      return false;
    }
  }

  // Get conversation with messages
  async getConversationWithMessages(conversationId: string, userId: string): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    try {
      const conversation = await storage.getConversation(conversationId, userId);
      if (!conversation) {
        return null;
      }

      const messages = await storage.getMessages(conversationId, userId);
      return { conversation, messages };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error fetching conversation with messages:', error);
      return null;
    }
  }

  // Export conversations for backup
  async exportConversations(userId: string): Promise<ChatMigrationData> {
    try {
      const conversations = await storage.getConversations(userId);
      const exportData: ChatMigrationData = { conversations: [] };

      for (const conversation of conversations) {
        const messages = await storage.getMessages(conversation.id, userId);
        exportData.conversations.push({
          id: conversation.id,
          title: conversation.title,
          mode: conversation.mode,
          lastActivity: conversation.lastActivity || new Date(),
          messages: messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            type: msg.type,
            timestamp: msg.timestamp || new Date()
          }))
        });
      }

      return exportData;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error exporting conversations:', error);
      throw new Error('Failed to export conversations');
    }
  }

  // Handle localStorage corruption recovery
  async handleCorruptedLocalStorage(userId: string, partialData?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Try to recover what we can from partial data
      if (partialData) {
        // Attempt to extract valid JSON fragments
        const jsonFragments = this.extractJsonFragments(partialData);
        if (jsonFragments.length > 0) {
          const recovered = await this.migrateFromLocalStorage(userId, JSON.stringify(jsonFragments));
          if (recovered.success) {
            return {
              success: true,
              message: `Recovered ${recovered.conversationsCreated} conversations and ${recovered.messagesCreated} messages from corrupted data`
            };
          }
        }
      }

      // Create a backup record of the corruption incident
      await storage.createConversationBackup(userId, {
        backupData: { 
          corruption: true, 
          timestamp: new Date().toISOString(),
          partialData: partialData ? partialData.substring(0, 1000) : null // Store first 1KB for analysis
        },
        source: 'manual'
      });

      return {
        success: false,
        message: 'localStorage data was corrupted and could not be recovered. A record of the incident has been saved.'
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error handling corrupted localStorage:', error);
      return {
        success: false,
        message: 'Failed to handle localStorage corruption: ' + (error as Error).message
      };
    }
  }

  // Helper method to extract valid JSON fragments from corrupted data
  private extractJsonFragments(corruptedData: string): any[] {
    const fragments: any[] = [];
    
    // Look for valid conversation-like objects
    const objectPattern = /\{[^{}]*"title"[^{}]*"messages"[^{}]*\}/g;
    const matches = corruptedData.match(objectPattern);
    
    if (matches) {
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match);
          if (parsed.title && parsed.messages) {
            fragments.push(parsed);
          }
        } catch (error) {
          // Skip invalid fragments
          continue;
        }
      }
    }
    
    return fragments;
  }

  // Clean up old conversations (archive conversations older than specified days)
  async archiveOldConversations(userId: string, daysOld: number = 90): Promise<{ archived: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const conversations = await storage.getConversations(userId);
      let archived = 0;

      for (const conversation of conversations) {
        const lastActivity = conversation.lastActivity || conversation.createdAt;
        if (lastActivity && lastActivity < cutoffDate) {
          await storage.archiveConversation(conversation.id, userId);
          archived++;
        }
      }

      return { archived };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error archiving old conversations:', error);
      throw new Error('Failed to archive old conversations');
    }
  }
}

export const chatService = new ChatService();