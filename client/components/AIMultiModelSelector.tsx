'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Loader2, Zap, Brain, Sparkles, Info } from 'lucide-react';
import { Skeleton, CardSkeleton } from './LoadingSkeleton';
// import { ErrorBoundary } from './ErrorBoundary'; // Temporarily disabled for build
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useErrorHandler } from '../hooks/useErrorHandler';
import ErrorDisplay from './ErrorDisplay';
import { parseApiError } from '../utils/errorHandler';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api';

interface AIModel {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
}

interface ModelComparison {
  prompt: string;
  taskType: string;
  outputs: Array<{
    model: string;
    content: string;
    tokens: number;
    success: boolean;
  }>;
  bestModel: string | null;
}

export default function AIMultiModelSelector() {
  const [providers, setProviders] = useState<AIModel[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('openai');
  const [currentModel, setCurrentModel] = useState<string>('gpt-4');
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<ModelComparison | null>(null);
  const [prompt, setPrompt] = useState('');
  const [taskType, setTaskType] = useState('content-generation');
  const [error, setError] = useState<Error | null>(null);
  const { handleError } = useErrorHandler();

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/ai/multi-model/models`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setProviders(data.data.providers);
        setCurrentProvider(data.data.currentProvider);
        setCurrentModel(data.data.currentModel);
      }
    } catch (err) {
      const apiError = parseApiError(err);
      setError(apiError);
      handleError(apiError);
    } finally {
      setLoading(false);
    }
  };

  const initProvider = async (provider: string, model: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/ai/multi-model/provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ provider, model }),
      });
      const data = await response.json();
      if (data.success) {
        setCurrentProvider(provider);
        setCurrentModel(model);
      }
    } catch (error) {
      console.error('Init provider error:', error);
    } finally {
      setLoading(false);
    }
  };

  const compareModels = async () => {
    if (!prompt) return;
    setComparing(true);
    try {
      const response = await fetch(`${API_URL}/ai/multi-model/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          prompt,
          taskType,
          models: ['gpt-4', 'gpt-3.5-turbo'],
        }),
      });
      const data = await response.json();
      if (data.success) {
        setComparison(data.data);
      }
    } catch (error) {
      console.error('Compare models error:', error);
    } finally {
      setComparing(false);
    }
  };

  const currentProviderData = providers.find(p => p.id === currentProvider);

  if (loading && providers.length === 0) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    // <ErrorBoundary> // Temporarily disabled for build
    <div className="space-y-6 animate-in fade-in duration-300">
      {error && (
        <ErrorDisplay
          error={error}
          onDismiss={() => setError(null)}
          variant="error"
        />
      )}
        <Card className="transition-shadow hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Multi-Model AI Selector
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select different AI models for various tasks</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Provider</label>
              <Select
                value={currentProvider}
                onValueChange={(value) => {
                  const provider = providers.find(p => p.id === value);
                  if (provider) {
                    initProvider(value, provider.defaultModel);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Model</label>
              <Select
                value={currentModel}
                onValueChange={(value) => initProvider(currentProvider, value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentProviderData?.models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline">{currentProvider}</Badge>
            <Badge variant="outline">{currentModel}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Model Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Task Type</label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="content-generation">Content Generation</SelectItem>
                <SelectItem value="content-analysis">Content Analysis</SelectItem>
                <SelectItem value="summarization">Summarization</SelectItem>
                <SelectItem value="translation">Translation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full p-2 border rounded"
              rows={4}
              placeholder="Enter prompt to compare models..."
            />
          </div>
          <Button onClick={compareModels} disabled={comparing || !prompt}>
            {comparing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Compare Models
              </>
            )}
          </Button>

          {comparison && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-muted rounded">
                <p className="font-medium mb-2">Best Model: {comparison.bestModel}</p>
              </div>
              {comparison.outputs.map((output, idx) => (
                <div key={idx} className="p-4 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <Badge>{output.model}</Badge>
                    <span className="text-sm text-muted-foreground">{output.tokens} tokens</span>
                  </div>
                  <p className="text-sm">{output.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

