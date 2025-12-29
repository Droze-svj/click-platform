'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, FileText, Play, Zap, Sparkles } from 'lucide-react';
import { Skeleton, CardSkeleton } from './LoadingSkeleton';
// import { ErrorBoundary } from './ErrorBoundary'; // Temporarily disabled for build
import { cn } from '../lib/utils';

interface WorkflowTemplate {
  name: string;
  description: string;
  triggers: Array<{ type: string; config: any }>;
  actions: Array<{ type: string; config: any }>;
  category: string;
}

export default function WorkflowTemplates() {
  const [templates, setTemplates] = useState<Record<string, WorkflowTemplate>>({});
  const [categories, setCategories] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/workflows/templates', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Fetch templates error:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/workflows/templates/categories', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Fetch categories error:', error);
    }
  };

  const createFromTemplate = async (templateId: string) => {
    setCreating(templateId);
    try {
      const response = await fetch('/api/workflows/templates/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ templateId }),
      });
      const data = await response.json();
      if (data.success) {
        alert('Workflow created successfully!');
      }
    } catch (error) {
      console.error('Create from template error:', error);
    } finally {
      setCreating(null);
    }
  };

  return (
    // <ErrorBoundary> // Temporarily disabled for build
    <div className="space-y-6 animate-in fade-in duration-300">
        <Card className="transition-shadow hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Workflow Templates
              <Badge variant="outline" className="ml-auto">
                {Object.keys(templates).length} templates
              </Badge>
            </CardTitle>
          </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(categories).map(([category, items]) => (
              <div key={category}>
                <h3 className="font-semibold mb-3 capitalize">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((item) => {
                    const template = templates[item.id];
                    if (!template) return null;
                    return (
                      <Card 
                        key={item.id}
                        className={cn(
                          "transition-all hover:shadow-lg hover:scale-[1.02]",
                          "animate-in fade-in slide-in-from-bottom-4 duration-300"
                        )}
                      >
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            {item.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{template.triggers.length} triggers</Badge>
                            <Badge variant="outline">{template.actions.length} actions</Badge>
                          </div>
                          <Button
                            onClick={() => createFromTemplate(item.id)}
                            disabled={creating === item.id}
                            className="w-full"
                          >
                            {creating === item.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" />
                                Use Template
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

