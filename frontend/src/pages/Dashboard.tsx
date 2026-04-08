import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Users,
  TrendingUp,
  CheckCircle,
  XCircle,
  Smartphone,
  RefreshCw,
  Activity,
  Zap,
  Send,
  UserPlus,
  Sparkles,
  ArrowUpRight,
  Clock,
  Key
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import api from '../services/api';
import { useSession } from '../contexts/SessionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  totalSessions: number;
  connectedSessions: number;
  disconnectedSessions: number;
  messagesSentToday: number;
  totalContacts: number;
  activeChats: number;
}

const Dashboard = () => {
  const { activeSession } = useSession();
  const [stats, setStats] = useState<Stats>({
    totalSessions: 0,
    connectedSessions: 0,
    disconnectedSessions: 0,
    messagesSentToday: 0,
    totalContacts: 0,
    activeChats: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [licenseKey, setLicenseKey] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [activeSession]);

  const fetchStats = async () => {
    try {
      setRefreshing(true);

      // Always fetch session list
      const sessionsRes = await api.get('/whatsapp/v1/sessions');
      const sessionData = sessionsRes.data?.data?.sessions || sessionsRes.data?.data;
      const sessions = Array.isArray(sessionData) ? sessionData : [];

      const connected = sessions.filter((s: any) => s.status === 'connected').length;
      const disconnected = sessions.length - connected;

      let messagesSentToday = 0;
      let totalContacts = 0;
      let activeChats = 0;

      // Only fetch stats if there's an active connected session
      if (activeSession && activeSession.status === 'connected') {
        try {
          const sessionStatsRes = await api.get(`/whatsapp/v1/dashboard/stats?session_id=${activeSession.session_id}`);
          if (sessionStatsRes?.data?.success) {
            messagesSentToday = sessionStatsRes.data.data.messages_sent_today || 0;
            totalContacts = sessionStatsRes.data.data.total_contacts || 0;
            activeChats = sessionStatsRes.data.data.active_chats || 0;
          }
        } catch {
          // Stats not available yet (session initializing), use defaults
        }
      }

      setStats({
        totalSessions: sessions.length,
        connectedSessions: connected,
        disconnectedSessions: disconnected,
        messagesSentToday,
        totalContacts,
        activeChats,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRedeemLicense = async () => {
    if (!licenseKey.trim()) return;
    setRedeeming(true);
    try {
      const res = await api.post('/subscription-packages/redeem', {
        key: licenseKey.trim()
      });
      // Optionally update local storage user data
      const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
      userData.ai_quota = res.data.data.ai_quota;
      userData.broadcast_quota = res.data.data.bc_quota;
      localStorage.setItem('user_data', JSON.stringify(userData));

      alert(res.data.message || 'License redeemed successfully');
      setLicenseKey('');
      window.location.reload(); // Refresh to update quotas visually 
    } catch (error: any) {
      console.error('Redeem error:', error);
      alert(error.response?.data?.message || 'Failed to redeem license');
    } finally {
      setRedeeming(false);
    }
  };

  const statCards = [
    {
      title: 'Total Sessions',
      value: stats.totalSessions,
      description: 'WhatsApp sessions',
      icon: Smartphone,
      trend: null,
      variant: 'blue' as const,
      change: '+12%'
    },
    {
      title: 'Connected',
      value: stats.connectedSessions,
      description: 'Active connections',
      icon: CheckCircle,
      trend: '+100%',
      variant: 'green' as const,
      change: '+8%'
    },
    {
      title: 'Disconnected',
      value: stats.disconnectedSessions,
      description: 'Inactive sessions',
      icon: XCircle,
      trend: null,
      variant: 'red' as const,
      change: '-5%'
    },
    {
      title: 'Messages Today',
      value: stats.messagesSentToday,
      description: 'Sent messages',
      icon: MessageSquare,
      trend: null,
      variant: 'purple' as const,
      change: '+24%'
    },
    {
      title: 'Total Contacts',
      value: stats.totalContacts,
      description: 'Across all sessions',
      icon: Users,
      trend: null,
      variant: 'indigo' as const,
      change: '+15%'
    },
    {
      title: 'Active Chats',
      value: stats.activeChats,
      description: 'Ongoing conversations',
      icon: TrendingUp,
      trend: null,
      variant: 'orange' as const,
      change: '+32%'
    },
    {
      title: 'AI Quota',
      value: (() => {
        try { const u = JSON.parse(localStorage.getItem('user_data') || '{}'); return u.ai_quota; } catch { return 0; }
      })(),
      description: 'Auto-reply limits',
      icon: Zap,
      trend: null,
      variant: 'purple' as const,
      change: null
    },
    {
      title: 'Broadcast Quota',
      value: (() => {
        try { const u = JSON.parse(localStorage.getItem('user_data') || '{}'); return u.broadcast_quota; } catch { return 0; }
      })(),
      description: 'Bulk messaging limits',
      icon: Send,
      trend: null,
      variant: 'blue' as const,
      change: null
    },
  ];

  const getVariantStyles = (variant: string) => {
    const styles = {
      blue: 'border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-blue-100/40 backdrop-blur-sm hover:shadow-blue-200/50',
      green: 'border-green-200/50 bg-gradient-to-br from-green-50/80 to-emerald-100/40 backdrop-blur-sm hover:shadow-green-200/50',
      red: 'border-red-200/50 bg-gradient-to-br from-red-50/80 to-rose-100/40 backdrop-blur-sm hover:shadow-red-200/50',
      purple: 'border-purple-200/50 bg-gradient-to-br from-purple-50/80 to-violet-100/40 backdrop-blur-sm hover:shadow-purple-200/50',
      indigo: 'border-indigo-200/50 bg-gradient-to-br from-indigo-50/80 to-blue-100/40 backdrop-blur-sm hover:shadow-indigo-200/50',
      orange: 'border-orange-200/50 bg-gradient-to-br from-orange-50/80 to-amber-100/40 backdrop-blur-sm hover:shadow-orange-200/50',
    };
    return styles[variant as keyof typeof styles] || styles.blue;
  };

  const getIconStyles = (variant: string) => {
    const styles = {
      blue: 'text-green-600 bg-gradient-to-br from-blue-500 to-blue-600',
      green: 'text-green-600 bg-gradient-to-br from-green-500 to-emerald-600',
      red: 'text-red-600 bg-gradient-to-br from-red-500 to-rose-600',
      purple: 'text-purple-600 bg-gradient-to-br from-purple-500 to-violet-600',
      indigo: 'text-indigo-600 bg-gradient-to-br from-indigo-500 to-blue-600',
      orange: 'text-orange-600 bg-gradient-to-br from-orange-500 to-amber-600',
    };
    return styles[variant as keyof typeof styles] || styles.blue;
  };

  const quickActions = [
    { label: 'Add Session', description: 'Create new WhatsApp session', icon: Smartphone, gradient: 'from-blue-500 to-indigo-600' },
    { label: 'Send Message', description: 'Quick message sending', icon: Send, gradient: 'from-purple-500 to-pink-600' },
    { label: 'Manage Contacts', description: 'View and organize contacts', icon: UserPlus, gradient: 'from-green-500 to-emerald-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 p-4 md:p-6 lg:p-8">
      {/* Header with glassmorphism */}
      <div className="mb-8 backdrop-blur-xl bg-white/70 rounded-2xl p-6 border border-white/50 shadow-xl shadow-gray-200/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
              <span className="text-sm font-medium text-gray-600">Live Dashboard</span>
            </div>
            <p className="text-gray-600 mt-1 font-medium">Real-time statistics and insights</p>
          </div>

          <Button
            onClick={fetchStats}
            disabled={refreshing}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all duration-300 group"
          >
            <RefreshCw className={`mr-2 h-4 w-4 transition-transform duration-500 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Stats'}
          </Button>
        </div>
      </div>

      {/* Stats Grid with glassmorphism */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return loading ? (
            <Card key={index} className="backdrop-blur-xl bg-white/70 border-white/50 shadow-xl overflow-hidden">
              <CardHeader>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardHeader>
            </Card>
          ) : (
            <Card
              key={index}
              className={`backdrop-blur-xl bg-white/70 border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group ${getVariantStyles(card.variant)} hover:scale-105 relative`}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Sparkle effect */}
              <Sparkles className="absolute top-2 right-2 h-4 w-4 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />

              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-sm font-semibold text-gray-700">{card.title}</CardTitle>
                <div className={`p-2.5 rounded-xl shadow-lg ${getIconStyles(card.variant)} text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="flex items-baseline gap-2 mb-2">
                  <div className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    {card.value}
                  </div>
                  {card.change && (
                    <Badge variant="secondary" className="bg-white/50 text-gray-700 backdrop-blur-sm border-0 px-2 py-0.5">
                      <ArrowUpRight className="h-3 w-3 mr-0.5" />
                      {card.change}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-600 font-medium">{card.description}</p>
                {card.trend && (
                  <Badge variant="secondary" className="mt-2 bg-green-100/80 text-green-700 border-green-200/50 backdrop-blur-sm">
                    {card.trend}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions with premium design */}
      <Card className="mb-8 backdrop-blur-xl bg-white/70 border-white/50 shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-purple-50/50 pointer-events-none" />
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Zap className="h-5 w-5 text-yellow-500" />
                Quick Actions
              </CardTitle>
              <CardDescription className="font-medium">Frequently used shortcuts</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-2 backdrop-blur-sm bg-white/60 border-white/50 hover:bg-white/80 hover:shadow-xl hover:scale-105 transition-all duration-300 group relative overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${action.gradient} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-left relative z-10">
                    <div className="font-semibold text-gray-900">{action.label}</div>
                    <div className="text-xs text-gray-600">{action.description}</div>
                  </div>
                  <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Redeem License */}
      <Card className="mb-8 backdrop-blur-xl bg-white/70 border-white/50 shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 via-teal-50/30 to-emerald-50/50 pointer-events-none" />
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Key className="h-5 w-5 text-green-600" />
                Redeem License
              </CardTitle>
              <CardDescription className="font-medium">Enter your license key to activate a subscription package</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Input
              placeholder="e.g. LOKO-XXXX-YYYY"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              className="max-w-md uppercase"
            />
            <Button
              onClick={handleRedeemLicense}
              disabled={!licenseKey.trim() || redeeming}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            >
              {redeeming ? 'Activating...' : 'Activate'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent Activity */}
        <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              Recent Activity
            </CardTitle>
            <CardDescription className="font-medium">Latest system events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/30 backdrop-blur-sm border border-blue-100/50 hover:shadow-md transition-shadow duration-300">
                <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mt-2 shadow-lg shadow-blue-500/50 animate-pulse" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">System initialized successfully</p>
                  <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    Just now
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System  Status with premium glow */}
        <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-xl overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 via-emerald-50/30 to-teal-50/50 opacity-50 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <CardHeader className="relative z-10">
            <CardTitle>System Status</CardTitle>
            <CardDescription className="font-medium">Real-time monitoring</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-50/80 to-emerald-50/60 backdrop-blur-sm border border-green-200/50 shadow-lg relative overflow-hidden group/status hover:shadow-xl transition-shadow duration-300">
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-400/10 animate-pulse pointer-events-none" />

              <div className="flex items-center gap-3 relative z-10">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-500 rounded-full blur-lg opacity-50 animate-pulse" />
                  <div className="relative w-3 h-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full shadow-lg shadow-green-500/50 animate-pulse" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    All Systems Operational
                    <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
                  </p>
                  <p className="text-sm text-gray-600">No issues detected</p>
                </div>
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-lg shadow-green-500/30 px-3 py-1">
                  Online
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;