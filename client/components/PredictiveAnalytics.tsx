'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, TrendingUp, Clock, BarChart3, Info } from 'lucide-react';
import { Skeleton, CardSkeleton } from './LoadingSkeleton';
// import { ErrorBoundary } from './ErrorBoundary'; // Temporarily disabled for build
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';

interface PerformancePrediction {
  expectedViews: { min: number; max: number };
  expectedEngagementRate: number;
  expectedLikes: number;
  expectedShares: number;
  performanceScore: number;
  positiveFactors: string[];
  negativeFactors: string[];
  recommendations: string[];
}

export default function PredictiveAnalytics() {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<PerformancePrediction | null>(null);
  const [contentData, setContentData] = useState({
    title: '',
    platform: 'instagram',
    tags: [] as string[],
    category: '',
  });

  const predictPerformance = async () => {
    if (!contentData.title || !contentData.body) return;
    setLoading(true);
    try {
      const response = await fetch('/api/ai/predictive/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(contentData),
      });
      const data = await response.json();
      if (data.success) {
        setPrediction(data.data);
      }
    } catch (error) {
      console.error('Predict performance error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    // <ErrorBoundary> // Temporarily disabled for build
    <div className="space-y-6 animate-in fade-in duration-300">
        <Card className="transition-shadow hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Performance Prediction
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Predict how your content will perform before publishing</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Title</label>
            <input
              type="text"
              value={contentData.title}
              onChange={(e) => setContentData({ ...contentData, title: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="Content title..."
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Body</label>
            <textarea
              value={contentData.body}
              onChange={(e) => setContentData({ ...contentData, body: e.target.value })}
              className="w-full p-2 border rounded"
              rows={4}
              placeholder="Content body..."
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Platform</label>
            <select
              value={contentData.platform}
              onChange={(e) => setContentData({ ...contentData, platform: e.target.value })}
              className="w-full p-2 border rounded"
            >
              <option value="instagram">Instagram</option>
              <option value="twitter">Twitter</option>
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>
          <Button onClick={predictPerformance} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Predicting...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                Predict Performance
              </>
            )}
          </Button>

          {loading && !prediction && (
            <CardSkeleton />
          )}

          {prediction && (
            <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Performance Score</span>
                  <Badge 
                    variant={prediction.performanceScore > 70 ? 'default' : 'secondary'}
                    className={cn(
                      "text-lg px-3 py-1",
                      prediction.performanceScore > 70 && "bg-green-500 hover:bg-green-600"
                    )}
                  >
                    {prediction.performanceScore}/100
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Views</p>
                    <p className="font-semibold">
                      {prediction.expectedViews.min.toLocaleString()} - {prediction.expectedViews.max.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Engagement Rate</p>
                    <p className="font-semibold">{prediction.expectedEngagementRate}%</p>
                  </div>
                </div>
              </div>

              {prediction.positiveFactors.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Positive Factors</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {prediction.positiveFactors.map((factor, i) => (
                      <li key={i}>{factor}</li>
                    ))}
                  </ul>
                </div>
              )}

              {prediction.recommendations.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Recommendations</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {prediction.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

