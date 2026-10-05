import React from 'react';
import { Card } from '../components/ui/Card';

export default function Loading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center py-12 px-4">
      <Card className="p-8 text-center space-y-4 max-w-sm w-full bg-surface-card/90 border-border/80">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-xs font-mono text-slate-300">Loading CredaVer Network...</div>
      </Card>
    </div>
  );
}
