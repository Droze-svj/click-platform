'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Server, Database, Cpu, HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';
import { Skeleton, CardSkeleton } from './LoadingSkeleton';
// import { ErrorBoundary } from './ErrorBoundary'; // Temporarily disabled for build
import { cn } from '../lib/utils';

interface ResourceStatus {
  memory: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  cpu: {
    cores: number;
    usage: number;
    loadAverage: number[];
  };
  healthy: boolean;
  alerts: Array<{
    type: string;
    severity: string;
  }>;
}

export default function InfrastructureDashboard() {
  const [resources, setResources] = useState<ResourceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResources();
    const interval = setInterval(fetchResources, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchResources = async () => {
    try {
      const response = await fetch('/api/infrastructure/resources/thresholds', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setResources(data.data);
      }
    } catch (error) {
      console.error('Fetch resources error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !resources) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    // <ErrorBoundary> // Temporarily disabled for build
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
      <Card className={cn(
        "transition-shadow hover:shadow-lg",
        resources.cpu.usage > 80 && "border-red-200 bg-red-50/50"
      )}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className={cn(
              "h-5 w-5",
              resources.cpu.usage > 80 ? "text-red-600" : "text-blue-600"
            )} />
            CPU Usage
            {resources.cpu.usage > 80 ? (
              <AlertTriangle className="h-4 w-4 text-red-600 ml-auto" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Usage</span>
              <Badge variant={resources.cpu.usage > 80 ? 'destructive' : 'default'}>
                {resources.cpu.usage.toFixed(1)}%
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className={cn(
                  "h-3 rounded-full transition-all duration-500",
                  resources.cpu.usage > 80 ? "bg-red-500" : 
                  resources.cpu.usage > 60 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(resources.cpu.usage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{resources.cpu.cores} cores</p>
          </div>
        </CardContent>
      </Card>

      <Card className={cn(
        "transition-shadow hover:shadow-lg",
        resources.memory.percent > 80 && "border-red-200 bg-red-50/50"
      )}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className={cn(
              "h-5 w-5",
              resources.memory.percent > 80 ? "text-red-600" : "text-blue-600"
            )} />
            Memory Usage
            {resources.memory.percent > 80 ? (
              <AlertTriangle className="h-4 w-4 text-red-600 ml-auto" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Usage</span>
              <Badge variant={resources.memory.percent > 80 ? 'destructive' : 'default'}>
                {resources.memory.percent.toFixed(1)}%
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className={cn(
                  "h-3 rounded-full transition-all duration-500",
                  resources.memory.percent > 80 ? "bg-red-500" : 
                  resources.memory.percent > 60 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(resources.memory.percent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {(resources.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB /{' '}
              {(resources.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB
            </p>
          </div>
        </CardContent>
      </Card>

      {resources.alerts.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resources.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded ${
                    alert.severity === 'critical' ? 'bg-destructive/10' : 'bg-yellow-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{alert.type}</span>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

