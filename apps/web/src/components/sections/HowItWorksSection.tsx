import React from 'react';
import { Card } from '../ui/Card';
import { KeyRound, SendHorizontal, ShieldCheck, ArrowRight } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Operator signs a mandate',
      description: 'Operator defines scoped allowances, per-transaction limits, and total caps signed with their Phantom wallet.',
      icon: KeyRound,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
    },
    {
      num: '02',
      title: 'Agent requests an x402 payment',
      description: 'Agent holds zero funding keys and submits request-bound payment proofs to CredaVer via the constrained signer.',
      icon: SendHorizontal,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    {
      num: '03',
      title: 'CredaVer decides & issues receipt',
      description: 'CredaVer deterministically evaluates ALLOW, DENY, or REVIEW and signs a verifiable Ed25519 decision receipt.',
      icon: ShieldCheck,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20',
    },
  ];

  return (
    <section id="how-it-works" className="py-12 border-t border-border/50 space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          How it works
        </h2>
        <p className="text-sm text-muted">
          Three deterministic steps separate wallet custody from autonomous agent execution.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <Card
              key={step.num}
              className="p-6 relative border-border/80 bg-surface-card/80 hover:border-cyan-500/40 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl ${step.bgColor} border ${step.borderColor} flex items-center justify-center ${step.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-muted">{step.num}</span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-border">
                  <ArrowRight className="w-5 h-5 text-slate-600" />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
};
