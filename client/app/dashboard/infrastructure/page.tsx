'use client';

import { useState, useEffect } from 'react';

// Force dynamic rendering to avoid SSR issues with localStorage
export const dynamic = 'force-dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import Navbar from '../../../components/Navbar';
import InfrastructureDashboard from '../../../components/InfrastructureDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Server, Database, Cpu, HardDrive } from 'lucide-react';

export default function InfrastructurePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Check if user is admin (you may need to adjust this based on your auth system)
    const checkAdmin = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;

        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        const userData = data.user || data.data?.user;
        setIsAdmin(userData?.role === 'admin' || userData?.isAdmin === true);
      } catch (error) {
        console.error('Failed to check admin status', error);
      }
    };

    checkAdmin();
  }, [user, router]);

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
              <p className="text-gray-600">
                This page is only accessible to administrators.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Server className="h-8 w-8 text-purple-600" />
            Infrastructure Monitoring
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor system resources, performance, and health
          </p>
        </div>

        <InfrastructureDashboard />
      </div>
    </div>
  );
}






