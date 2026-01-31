'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
// Navbar removed - provided by dashboard layout
import AIMultiModelSelector from '../../../components/AIMultiModelSelector';
import AIRecommendations from '../../../components/AIRecommendations';
import PredictiveAnalytics from '../../../components/PredictiveAnalytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Brain, TrendingUp, Sparkles, BarChart3 } from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { CardSkeleton } from '../../../components/LoadingSkeleton';

export default function AIFeaturesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (!user && typeof window !== 'undefined') {
      router.push('/login');
    }
  }, [user, router]);

  if (!isClient || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-600" />
            AI Features
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Advanced AI-powered tools to enhance your content creation
          </p>
        </div>

        <ErrorBoundary>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="models">AI Models</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Multi-Model AI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose from multiple AI providers and models for different tasks
                  </p>
                  <button
                    onClick={() => setActiveTab('models')}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    Explore Models
                  </button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get personalized content recommendations based on your history
                  </p>
                  <button
                    onClick={() => setActiveTab('recommendations')}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    View Recommendations
                  </button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Predictive Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Predict content performance before publishing
                  </p>
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    Try Analytics
                  </button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

            <TabsContent value="models" className="animate-in fade-in duration-300">
              <Suspense fallback={<CardSkeleton />}>
                <AIMultiModelSelector />
              </Suspense>
            </TabsContent>

            <TabsContent value="recommendations" className="animate-in fade-in duration-300">
              <Suspense fallback={<CardSkeleton />}>
                <AIRecommendations />
              </Suspense>
            </TabsContent>

            <TabsContent value="analytics" className="animate-in fade-in duration-300">
              <Suspense fallback={<CardSkeleton />}>
                <PredictiveAnalytics />
              </Suspense>
            </TabsContent>
          </Tabs>
        </ErrorBoundary>
      </div>
    </div>
  );
}

