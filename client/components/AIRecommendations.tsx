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
import { apiGet } from '../lib/api';

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

  const normalizeRecommendations = (raw: any): RecommendationsData => {
    // Ensure recommendations array and each recommendation has required fields
    const recommendations = Array.isArray(raw?.recommendations) 
      ? raw.recommendations.map((rec: any) => ({
          title: rec?.title || 'Untitled Recommendation',
          description: rec?.description || '',
          platform: rec?.platform || 'Unknown',
          reasoning: rec?.reasoning || '',
          keyPoints: Array.isArray(rec?.keyPoints) ? rec.keyPoints : [],
        }))
      : [];
    
    return {
      recommendations,
      preferences: {
        categories: Array.isArray(raw?.preferences?.categories) ? raw.preferences.categories : [],
        platforms: Array.isArray(raw?.preferences?.platforms) ? raw.preferences.platforms : [],
        topTopics: Array.isArray(raw?.preferences?.topTopics) ? raw.preferences.topTopics : [],
      },
      basedOn: {
        contentAnalyzed: typeof raw?.basedOn?.contentAnalyzed === 'number' ? raw.basedOn.contentAnalyzed : 0,
        topCategories: Array.isArray(raw?.basedOn?.topCategories) ? raw.basedOn.topCategories : [],
        topPlatforms: Array.isArray(raw?.basedOn?.topPlatforms) ? raw.basedOn.topPlatforms : [],
      },
    };
  };

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (platform) params.append('platform', platform);

      const response = await apiGet<any>(`/ai/recommendations/personalized?${params.toString()}`);
      
      // Handle different response formats
      if (response) {
        // Check if response has success field and data
        if (response.success && response.data) {
          setRecommendations(normalizeRecommendations(response.data));
        } 
        // Check if response is directly the data object
        else if (response.recommendations || response.preferences || response.basedOn) {
          setRecommendations(normalizeRecommendations(response));
        }
        // Otherwise, try to normalize whatever we got
        else {
          setRecommendations(normalizeRecommendations(response));
        }
      } else {
        // Empty response - set empty recommendations
        setRecommendations({
          recommendations: [],
          preferences: { categories: [], platforms: [], topTopics: [] },
          basedOn: { contentAnalyzed: 0, topCategories: [], topPlatforms: [] },
        });
      }
    } catch (err) {
      const apiError = parseApiError(err);
      const errorObj = new Error(apiError.message);
      (errorObj as any).code = apiError.code;
      setError(errorObj);
      // Set empty recommendations on error to prevent undefined state
      setRecommendations({
        recommendations: [],
        preferences: { categories: [], platforms: [], topTopics: [] },
        basedOn: { contentAnalyzed: 0, topCategories: [], topPlatforms: [] },
      });
    } finally {
      setLoading(false);
    }
  };

  // Side-effect: show toast/log via centralized error handler.
  // Keeping this out of the request catch avoids any render-phase updates during Fast Refresh / dev overlay.
  useEffect(() => {
    if (!error) return;
    handleError(error);
  }, [error, handleError]);

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
              Based on {recommendations.basedOn?.contentAnalyzed ?? 0} pieces of content
            </p>
            <div className="flex flex-wrap gap-2">
              {(recommendations.basedOn?.topCategories || []).map((cat) => (
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

        {recommendations && Array.isArray(recommendations.recommendations) && recommendations.recommendations.length > 0 && (
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
                  <h3 className="font-semibold">{rec?.title || 'Untitled Recommendation'}</h3>
                  <Badge>{rec?.platform || 'Unknown'}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{rec?.description || ''}</p>
                <p className="text-sm mb-3">{rec?.reasoning || ''}</p>
                {Array.isArray(rec?.keyPoints) && rec.keyPoints.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Key Points:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {rec.keyPoints.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {recommendations && (!Array.isArray(recommendations.recommendations) || recommendations.recommendations.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No recommendations available at this time.</p>
            <p className="text-sm mt-2">Try refreshing or check back later.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
