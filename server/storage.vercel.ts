// Add these methods to the existing storage.ts file for Clerk compatibility

// Additional method for Clerk user ID reconciliation
async updateUserClerkId(oldId: string, newClerkId: string): Promise<void> {
  try {
    console.log('[STORAGE] Updating user ID for Clerk migration:', { oldId, newClerkId });
    
    await this.db.update(users)
      .set({ id: newClerkId })
      .where(eq(users.id, oldId));
    
    // Update related tables
    await this.db.update(teamMembers)
      .set({ managerId: newClerkId })
      .where(eq(teamMembers.managerId, oldId));
      
    await this.db.update(conversations)
      .set({ userId: newClerkId })
      .where(eq(conversations.userId, oldId));
      
    await this.db.update(emailSubscriptions)
      .set({ userId: newClerkId })
      .where(eq(emailSubscriptions.userId, oldId));
      
    console.log('[STORAGE] User ID updated successfully for Clerk migration');
  } catch (error) {
    console.error('[STORAGE] Failed to update user ID for Clerk:', error);
    throw error;
  }
}

// Enhanced user session reconciliation for Clerk
async reconcileUserSession(userId: string, email: string): Promise<any> {
  try {
    console.log('[STORAGE] Reconciling user session:', { userId, email });
    
    // First try to get user by Clerk ID
    let user = await this.getUser(userId);
    
    if (user) {
      console.log('[STORAGE] User found by Clerk ID:', user.id);
      return user;
    }
    
    // If not found, try by email
    user = await this.getUserByEmail(email);
    
    if (user && user.id !== userId) {
      console.log('[STORAGE] User found by email, updating Clerk ID:', {
        oldId: user.id,
        newClerkId: userId
      });
      
      // Update the user ID to match Clerk ID
      await this.updateUserClerkId(user.id, userId);
      user = await this.getUser(userId);
    }
    
    return user;
  } catch (error) {
    console.error('[STORAGE] Failed to reconcile user session:', error);
    return null;
  }
}