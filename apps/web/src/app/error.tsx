'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6 border-rose-500/40 bg-surface-card/95 shadow-card">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <Badge variant="rose" className="font-mono text-xs">
            Application Error
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Something Went Wrong
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-mono break-words">
            {error.message || 'An unexpected client error occurred.'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="primary" size="sm" onClick={() => reset()}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            <span>Try Again</span>
          </Button>
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="w-3.5 h-3.5 mr-1.5" />
              <span>Return Home</span>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
