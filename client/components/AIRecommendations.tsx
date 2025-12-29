'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, Lightbulb, TrendingUp, Target, RefreshCw } from 'lucide-react';
import { Skeleton, CardSkeleton } from './LoadingSkeleton';
// import { ErrorBoundary } from './ErrorBoundary'; // Temporarily disabled for build
import { cn } from '../lib/utils';
import { useErrorHandler } from '../hooks/useErrorHandler';
import ErrorDisplay from './ErrorDisplay';
import { parseApiError } from '../utils/errorHandler';

interface Recommendation {
  title: string;
  description: string;
  platform: string;
  reasoning: string;
  keyPoints: string[];
}

interface RecommendationsData {
  recommendations: Recommendation[];
  preferences: {
    categories: string[];
    platforms: string[];
    topTopics: string[];
  };
  basedOn: {
    contentAnalyzed: number;
    topCategories: string[];
    topPlatforms: string[];
  };
}

export default function AIRecommendations() {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null);
  const [type, setType] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [error, setError] = useState<Error | null>(null);
  const { handleError } = useErrorHandler();

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (platform) params.append('platform', platform);

      const response = await fetch(`/api/ai/recommendations/personalized?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setRecommendations(data.data);
      }
    } catch (err) {
      const apiError = parseApiError(err);
      setError(apiError);
      handleError(apiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    // <ErrorBoundary> // Temporarily disabled for build
    <Card className="transition-shadow hover:shadow-lg animate-in fade-in duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            AI-Powered Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <ErrorDisplay
              error={error}
              onDismiss={() => setError(null)}
              variant="error"
            />
          )}
        {recommendations && (
          <div className="mb-4 p-4 bg-muted rounded">
            <p className="text-sm text-muted-foreground mb-2">
              Based on {recommendations.basedOn.contentAnalyzed} pieces of content
            </p>
            <div className="flex flex-wrap gap-2">
              {recommendations.basedOn.topCategories.map((cat) => (
                <Badge key={cat} variant="secondary">{cat}</Badge>
              ))}
            </div>
          </div>
        )}

        <Button 
          onClick={fetchRecommendations} 
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Recommendations
            </>
          )}
        </Button>

        {loading && !recommendations && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {recommendations && (
          <div className="space-y-4 mt-4">
            {recommendations.recommendations.map((rec, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "p-4 border rounded transition-all hover:shadow-md",
                  "animate-in fade-in slide-in-from-bottom-4",
                  "duration-300"
                )}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{rec.title}</h3>
                  <Badge>{rec.platform}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                <p className="text-sm mb-3">{rec.reasoning}</p>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Key Points:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {rec.keyPoints.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
