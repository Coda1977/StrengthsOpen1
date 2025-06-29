import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../hooks/useAuth';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  hasCompletedOnboarding: boolean;
  topStrengths: string[];
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailLog {
  id: string;
  userId: string;
  emailType: string;
  emailSubject: string;
  weekNumber?: string;
  status: string;
  sentAt: string;
  errorMessage?: string;
}

interface SystemHealth {
  database: string;
  openai: string;
  resend: string;
  timestamp: string;
}

interface Analytics {
  users: {
    total: number;
    onboarded: number;
    recent: number;
  };
  emails: {
    total: number;
    sent: number;
    failed: number;
    recent: number;
  };
  deliveryRate: number;
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [emailType, setEmailType] = useState<'welcome' | 'weekly'>('welcome');
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if user is admin and redirect immediately if not
  useEffect(() => {
    if (user && user.email !== 'tinymanagerai@gmail.com') {
      toast({
        title: "Access Denied",
        description: "Admin access required",
        variant: "destructive",
      });
      // Redirect to dashboard immediately
      window.location.href = '/dashboard';
      return;
    }
    
    // Only fetch data if user is admin
    if (user?.email === 'tinymanagerai@gmail.com') {
      fetchData();
    }
  }, [user, toast]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [usersRes, emailLogsRes, healthRes, analyticsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/emails'),
        fetch('/api/admin/health'),
        fetch('/api/admin/analytics'),
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (emailLogsRes.ok) setEmailLogs(await emailLogsRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch admin data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "User deleted successfully",
        });
        fetchData();
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const sendTestEmail = async () => {
    if (!selectedUser) {
      toast({
        title: "Error",
        description: "Please select a user first",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/admin/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailType, userId: selectedUser }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: result.message,
        });
      } else {
        throw new Error('Failed to send test email');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test email",
        variant: "destructive",
      });
    }
  };

  const sendWeeklyEmails = async () => {
    if (!confirm('Send weekly emails to all eligible users?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/emails/send-weekly', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: result.message,
        });
        fetchData();
      } else {
        throw new Error('Failed to send weekly emails');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send weekly emails",
        variant: "destructive",
      });
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'no_key': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getHealthStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return 'Healthy';
      case 'error': return 'Error';
      case 'no_key': return 'No API Key';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!user || user.email !== 'tinymanagerai@gmail.com') {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>Access denied. Admin privileges required.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button onClick={fetchData} variant="outline">Refresh</Button>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.users.total}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.users.onboarded} completed onboarding
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.users.recent}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.deliveryRate}%</div>
              <p className="text-xs text-muted-foreground">
                {analytics.emails.sent} sent, {analytics.emails.failed} failed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Emails</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.emails.recent}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* System Health */}
      {health && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Last updated: {new Date(health.timestamp).toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getHealthStatusColor(health.database)}`}></div>
                <span>Database: {getHealthStatusText(health.database)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getHealthStatusColor(health.openai)}`}></div>
                <span>OpenAI: {getHealthStatusText(health.openai)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getHealthStatusColor(health.resend)}`}></div>
                <span>Resend: {getHealthStatusText(health.resend)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="testing">Email Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage users and their onboarding status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Strengths</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.hasCompletedOnboarding ? "default" : "secondary"}>
                          {user.hasCompletedOnboarding ? "Completed" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.topStrengths?.slice(0, 3).join(', ')}
                        {user.topStrengths?.length > 3 && '...'}
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteUser(user.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Logs</CardTitle>
              <CardDescription>Recent email activity and delivery status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.emailType}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{log.emailSubject}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={log.status === 'sent' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.weekNumber || '-'}</TableCell>
                      <TableCell>
                        {new Date(log.sentAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.errorMessage || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Testing</CardTitle>
              <CardDescription>Test email functionality and manually send weekly emails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Select User</label>
                  <select
                    className="w-full mt-1 p-2 border rounded"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="">Choose a user...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Email Type</label>
                  <select
                    className="w-full mt-1 p-2 border rounded"
                    value={emailType}
                    onChange={(e) => setEmailType(e.target.value as 'welcome' | 'weekly')}
                  >
                    <option value="welcome">Welcome Email</option>
                    <option value="weekly">Weekly Email</option>
                  </select>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={sendTestEmail} disabled={!selectedUser}>
                  Send Test Email
                </Button>
                <Button onClick={sendWeeklyEmails} variant="outline">
                  Send Weekly Emails
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 