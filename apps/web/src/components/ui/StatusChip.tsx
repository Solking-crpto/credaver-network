import React from 'react';
import { Badge } from './Badge';

export interface StatusChipProps {
  status: 'ALLOW' | 'DENY' | 'REVIEW' | 'ACTIVE' | 'REVOKED' | 'EXPIRED' | string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const normalized = status.toUpperCase();

  switch (normalized) {
    case 'ALLOW':
    case 'ACTIVE':
      return <Badge variant="green">{normalized}</Badge>;
    case 'DENY':
    case 'REVOKED':
    case 'ERROR':
      return <Badge variant="rose">{normalized}</Badge>;
    case 'REVIEW':
    case 'EXPIRED':
      return <Badge variant="amber">{normalized}</Badge>;
    default:
      return <Badge variant="cyan">{normalized}</Badge>;
  }
};
