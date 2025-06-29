import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Navigation from '@/components/Navigation';

interface EmailSubscription {
  id: string;
  emailType: 'welcome' | 'weekly_coaching';
  isActive: boolean;
  timezone: string;
  weeklyEmailCount: string;
}

interface EmailLog {
  id: string;
  emailType: 'welcome' | 'weekly_coaching';
  emailSubject: string;
  weekNumber?: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt: string;
}

const EmailSettings = () => {
  const [subscriptions, setSubscriptions] = useState<EmailSubscription[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const timezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Australia/Sydney'
  ];

  useEffect(() => {
    fetchEmailData();
  }, []);

  const fetchEmailData = async () => {
    try {
      const [subsResponse, logsResponse] = await Promise.all([
        fetch('/api/email-subscriptions', { credentials: 'include' }),
        fetch('/api/email-logs', { credentials: 'include' })
      ]);

      if (subsResponse.ok) {
        const subsData = await subsResponse.json();
        setSubscriptions(subsData.data || []);
      }

      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setEmailLogs(logsData.data || []);
      }
    } catch (error) {
      console.error('Error fetching email data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async (emailType: string, updates: { isActive?: boolean; timezone?: string }) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/email-subscriptions/${emailType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        await fetchEmailData();
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      sent: 'default' as const,
      failed: 'destructive' as const,
      pending: 'secondary' as const
    };
    return <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getWeeklyProgress = () => {
    const weeklySub = subscriptions.find(s => s.emailType === 'weekly_coaching');
    if (!weeklySub) return { current: 0, total: 12 };
    
    const current = parseInt(weeklySub.weeklyEmailCount || '0');
    return { current, total: 12 };
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <div className="dashboard">
          <div className="main-container">
            <div className="flex justify-center items-center min-h-64">
              <div className="text-center">Loading email settings...</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const progress = getWeeklyProgress();

  return (
    <>
      <Navigation />
      <div className="dashboard">
        <div className="main-container">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Email Settings</h1>
              <p className="text-text-secondary">Manage your email subscriptions and delivery preferences</p>
            </div>

            {/* Email Subscriptions */}
            <Card>
              <CardHeader>
                <CardTitle>Email Subscriptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {subscriptions.map((subscription) => (
                  <div key={subscription.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <h3 className="font-medium">
                        {subscription.emailType === 'welcome' ? 'Welcome Email' : 'Weekly Coaching Emails'}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        {subscription.emailType === 'welcome' 
                          ? 'Sent immediately after onboarding completion'
                          : `Weekly coaching insights (${progress.current}/${progress.total} sent)`
                        }
                      </p>
                      {subscription.emailType === 'weekly_coaching' && progress.current < progress.total && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-secondary">
                            {progress.total - progress.current} weeks remaining
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {subscription.emailType === 'weekly_coaching' && (
                        <Select
                          value={subscription.timezone}
                          onValueChange={(value) => updateSubscription(subscription.emailType, { timezone: value })}
                          disabled={updating}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timezones.map((tz) => (
                              <SelectItem key={tz} value={tz}>
                                {tz.replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      <Switch
                        checked={subscription.isActive}
                        onCheckedChange={(checked) => updateSubscription(subscription.emailType, { isActive: checked })}
                        disabled={updating || (subscription.emailType === 'weekly_coaching' && progress.current >= progress.total)}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Email History */}
            <Card>
              <CardHeader>
                <CardTitle>Email History</CardTitle>
              </CardHeader>
              <CardContent>
                {emailLogs.length === 0 ? (
                  <p className="text-text-secondary text-center py-8">No emails sent yet</p>
                ) : (
                  <div className="space-y-3">
                    {emailLogs.slice(0, 10).map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="space-y-1">
                          <div className="font-medium">{log.emailSubject}</div>
                          <div className="text-sm text-text-secondary">
                            {log.emailType === 'weekly_coaching' && log.weekNumber && `Week ${log.weekNumber} • `}
                            {formatDate(log.sentAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(log.status)}
                        </div>
                      </div>
                    ))}
                    {emailLogs.length > 10 && (
                      <p className="text-sm text-text-secondary text-center pt-4">
                        Showing 10 most recent emails
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Email Schedule Info */}
            <Card>
              <CardHeader>
                <CardTitle>Schedule Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Weekly emails sent:</span>
                    <span>Every Monday at 9:00 AM (your local time)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Total duration:</span>
                    <span>12 weeks of coaching content</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Auto-stop:</span>
                    <span>Emails automatically stop after 12 weeks</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default EmailSettings;