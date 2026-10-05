'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export const EarlyAccessSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          agentDescription: agentDescription.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit request');
      }

      setSuccessMessage(data.message || 'Thank you for requesting early access.');
      setEmail('');
      setAgentDescription('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="early-access" className="py-12 border-t border-border/50">
      <Card className="max-w-2xl mx-auto p-6 sm:p-8 border-border/90 bg-surface-card/90 shadow-card space-y-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-2">
            <Mail className="w-5 h-5" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Request early access
          </h2>
          <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">
            Leave your email and I&apos;ll tell you when a hosted version is ready.
          </p>
        </div>

        {successMessage ? (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-white">{successMessage}</p>
            <p className="text-xs text-muted">
              We have recorded your email and will tell you when a hosted version is ready.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="ea-email" className="block text-xs font-mono text-muted">
                Email Address <span className="text-cyan-400">*</span>
              </label>
              <Input
                id="ea-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@company.com"
                className="font-mono text-xs min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ea-agents" className="block text-xs font-mono text-muted">
                What agents do you run? <span className="text-slate-500">(Optional)</span>
              </label>
              <Input
                id="ea-agents"
                type="text"
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                placeholder="e.g. Trading bot, customer service bot, data-scraping agent"
                className="font-mono text-xs min-h-[44px]"
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 flex items-center gap-2 text-xs font-mono text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              className="w-full justify-center min-h-[44px] shadow-glow"
            >
              <span>Submit Early Access Request</span>
            </Button>

            <p className="text-[11px] text-center text-slate-500 leading-normal pt-1">
              Privacy note: We only use your email to notify you when a hosted version is ready. No marketing spam, no third-party data sharing. Anonymous, cookieless page-view analytics are powered by Vercel Analytics.
            </p>
          </form>
        )}
      </Card>
    </section>
  );
};
