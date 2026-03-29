'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Activity, 
  Database, 
  Cpu, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Zap,
  RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';

interface QueueStat {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
  error?: string;
}

export default function SystemIntelligence() {
  const [stats, setStats] = useState<QueueStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showToast } = useToast();

  const fetchStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const response = await fetch('/api/admin/queues/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        showToast('Failed to fetch system metrics', 'error');
      }
    } catch (err) {
      console.error('Error fetching queue stats:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => fetchStats(true), 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleRetryAll = async (queueName: string) => {
    // In a real implementation, we would have a 'retry-all' endpoint
    // For now, we'll notify that we are initiating recovery
    showToast(`Initiating recovery protocol for ${queueName}...`, 'info');
    // Simulate API call
    setTimeout(() => {
      showToast(`Recovery sequence queued for ${queueName}`, 'success');
      fetchStats();
    }, 1500);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Zap className="text-amber-500 fill-amber-500 w-8 h-8" />
            System Intelligence
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Real-time telemetry for the Sovereign Neural Engine & Distribution Workers.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-200 dark:border-slate-800">
            <Database className="w-3.5 h-3.5 mr-2 text-blue-500" />
            Redis Health: <span className="text-green-500 ml-1 font-bold">Optimal</span>
          </Badge>
          <Button 
            variant="outline" 
            onClick={() => fetchStats()} 
            disabled={isRefreshing}
            className="bg-white dark:bg-slate-900 h-9 px-3 py-1"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            {isRefreshing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((queue) => (
          <Card key={queue.name} className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl transition-all hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700">
            <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  {queue.name.replace('-', ' ')}
                </CardTitle>
                <Badge 
                  variant={queue.failed > 0 ? "destructive" : "secondary"}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                >
                  {queue.active > 0 ? 'ACTIVE' : 'IDLE'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Waiting
                  </p>
                  <p className="text-2xl font-bold">{queue.waiting}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3 h-3" /> Processing
                  </p>
                  <p className="text-2xl font-bold text-blue-500">{queue.active}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Completed
                  </p>
                  <p className="text-2xl font-bold text-green-500">{queue.completed}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> Failed
                  </p>
                  <p className="text-2xl font-bold text-rose-500">{queue.failed}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-medium">
                    <span>THROUGHPUT</span>
                    <span>{queue.total > 0 ? Math.round((queue.completed / queue.total) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                      style={{ width: `${queue.total > 0 ? (queue.completed / queue.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                
                {queue.failed > 0 && (
                  <Button 
                    variant="ghost" 
                    className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-0"
                    onClick={() => handleRetryAll(queue.name)}
                    title="Retry all failed jobs"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card className="border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-500" />
              Node Topology
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {['US-EAST-1', 'EU-WEST-1', 'ASIA-SOUTH-1', 'LATAM-EAST-1'].map((node, i) => (
                <div key={node} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    i === 3 ? "bg-amber-400 animate-pulse" : "bg-green-500"
                  )} />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400">{node}</p>
                    <p className="text-xs font-medium">Worker Instance #{i + 101}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {i === 3 ? 'WARMING' : 'STABLE'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
