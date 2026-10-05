import React from 'react';
import Link from 'next/link';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AlertCircle, ArrowLeft, Home, Play, FileCheck2, BookOpen } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <Card glow className="max-w-lg w-full p-8 text-center space-y-6 border-cyan-500/30 bg-surface-card/95">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <Badge variant="cyan" className="font-mono text-xs">
            404 Not Found
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Page Does Not Exist
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            The route you requested could not be located on the CredaVer Network portal.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
          <Link href="/">
            <Button variant="outline" size="sm" className="w-full justify-center">
              <Home className="w-3.5 h-3.5 mr-1.5" />
              <span>Home</span>
            </Button>
          </Link>
          <Link href="/demo">
            <Button variant="primary" size="sm" className="w-full justify-center">
              <Play className="w-3.5 h-3.5 mr-1.5" />
              <span>Live Demo</span>
            </Button>
          </Link>
          <Link href="/receipts">
            <Button variant="outline" size="sm" className="w-full justify-center">
              <FileCheck2 className="w-3.5 h-3.5 mr-1.5" />
              <span>Receipts</span>
            </Button>
          </Link>
          <Link href="/docs">
            <Button variant="outline" size="sm" className="w-full justify-center">
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              <span>Docs</span>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
