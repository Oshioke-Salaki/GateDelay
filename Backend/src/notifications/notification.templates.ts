import { NotificationType } from './notification.entity';

interface Template {
  title: (data?: Record<string, unknown>) => string;
  body: (data?: Record<string, unknown>) => string;
  emailHtml: (data?: Record<string, unknown>) => string;
  severity: 'info' | 'warning' | 'critical';
  channels: ('email' | 'push' | 'in-app')[];
  metadata?: {
    actionUrl?: string;
    actionLabel?: string;
    category?: string;
  };
}

export const TEMPLATES: Record<NotificationType, Template> = {
  trade_confirmation: {
    title: () => 'Trade Confirmed',
    body: (d) =>
      `Your trade on "${d?.market ?? 'market'}" was confirmed. Amount: ${d?.amount ?? '—'}`,
    emailHtml: (d) =>
      `<p>Your trade on <strong>${d?.market ?? 'market'}</strong> has been confirmed.</p><p>Amount: ${d?.amount ?? '—'}</p>`,
    severity: 'info',
    channels: ['in-app', 'push'],
    metadata: { category: 'trading' },
  },
  market_update: {
    title: (d) => `Market Update: ${d?.market ?? ''}`,
    body: (d) => `${d?.message ?? 'A market you follow has been updated.'}`,
    emailHtml: (d) =>
      `<p><strong>${d?.market ?? 'A market'}</strong> has been updated.</p><p>${d?.message ?? ''}</p>`,
    severity: 'info',
    channels: ['in-app', 'push'],
    metadata: { category: 'markets' },
  },
  price_alert: {
    title: (d) => `Price Alert: ${d?.market ?? ''}`,
    body: (d) => `Price moved to ${d?.price ?? '—'} (${d?.change ?? ''})`,
    emailHtml: (d) =>
      `<p>Price alert triggered for <strong>${d?.market ?? 'market'}</strong>.</p><p>Current price: ${d?.price ?? '—'} (${d?.change ?? ''})</p>`,
    severity: 'warning',
    channels: ['in-app', 'push', 'email'],
    metadata: { category: 'alerts' },
  },
  system: {
    title: () => 'System Notification',
    body: (d) => `${d?.message ?? 'A system event occurred.'}`,
    emailHtml: (d) => `<p>${d?.message ?? 'A system event occurred.'}</p>`,
    severity: 'info',
    channels: ['in-app'],
    metadata: { category: 'system' },
  },
  weekly_digest: {
    title: () => 'Your Weekly GateDelay Digest',
    body: (d) =>
      `You had ${d?.trades ?? 0} trades this week. P&L: ${d?.pnl ?? '—'}`,
    emailHtml: (d) =>
      `<h2>Weekly Digest</h2><p>Trades: ${d?.trades ?? 0}</p><p>P&L: ${d?.pnl ?? '—'}</p>`,
    severity: 'info',
    channels: ['email', 'in-app'],
    metadata: { category: 'digest' },
  },
  trade_filled: {
    title: (d) => `Trade Filled: ${d?.market ?? 'Market'}`,
    body: (d) =>
      `Your ${d?.side ?? 'order'} for ${d?.amount ?? '—'} ${d?.outcome ?? ''} @ ${d?.price ?? '—'} has been filled.`,
    emailHtml: (d) =>
      `<p>Your <strong>${d?.side ?? 'order'}</strong> has been filled.</p>` +
      `<p><strong>Market:</strong> ${d?.market ?? '—'}</p>` +
      `<p><strong>Outcome:</strong> ${d?.outcome ?? '—'}</p>` +
      `<p><strong>Amount:</strong> ${d?.amount ?? '—'}</p>` +
      `<p><strong>Price:</strong> ${d?.price ?? '—'}</p>` +
      `<p><strong>Fill Time:</strong> ${d?.filledAt ?? new Date().toISOString()}</p>`,
    severity: 'info',
    channels: ['in-app', 'push', 'email'],
    metadata: {
      category: 'trading',
      actionUrl: '/portfolio/trades',
      actionLabel: 'View Trade',
    },
  },
  dispute_opened: {
    title: (d) => `Dispute Opened: ${d?.market ?? 'Market'}`,
    body: (d) =>
      `A dispute has been opened for "${d?.market ?? 'market'}" by ${d?.disputedBy ?? 'a user'}. Reason: ${d?.reason ?? '—'}`,
    emailHtml: (d) =>
      `<h2>Dispute Opened</h2>` +
      `<p>A dispute has been opened for <strong>${d?.market ?? 'market'}</strong>.</p>` +
      `<p><strong>Disputed By:</strong> ${d?.disputedBy ?? '—'}</p>` +
      `<p><strong>Reason:</strong> ${d?.reason ?? '—'}</p>` +
      `<p><strong>Dispute ID:</strong> ${d?.disputeId ?? '—'}</p>` +
      `<p><strong>Opened At:</strong> ${d?.openedAt ?? new Date().toISOString()}</p>`,
    severity: 'warning',
    channels: ['in-app', 'push', 'email'],
    metadata: {
      category: 'disputes',
      actionUrl: '/disputes',
      actionLabel: 'View Dispute',
    },
  },
  market_resolved: {
    title: (d) => `Market Resolved: ${d?.market ?? 'Market'}`,
    body: (d) =>
      `Market "${d?.market ?? 'market'}" has been resolved. Winning outcome: ${d?.winningOutcome ?? '—'}. Your payout: ${d?.payout ?? '—'}`,
    emailHtml: (d) =>
      `<h2>Market Resolved</h2>` +
      `<p>Market <strong>${d?.market ?? 'market'}</strong> has been resolved.</p>` +
      `<p><strong>Winning Outcome:</strong> ${d?.winningOutcome ?? '—'}</p>` +
      `<p><strong>Resolution Time:</strong> ${d?.resolvedAt ?? new Date().toISOString()}</p>` +
      `${d?.payout ? `<p><strong>Your Payout:</strong> ${d?.payout}</p>` : ''}` +
      `${d?.position ? `<p><strong>Your Position:</strong> ${d?.position}</p>` : ''}`,
    severity: 'critical',
    channels: ['in-app', 'push', 'email'],
    metadata: {
      category: 'markets',
      actionUrl: '/portfolio/positions',
      actionLabel: 'View Position',
    },
  },
};

export function renderTemplate(
  type: NotificationType,
  data?: Record<string, unknown>,
) {
  const t = TEMPLATES[type];
  return {
    title: t.title(data),
    body: t.body(data),
    emailHtml: t.emailHtml(data),
    severity: t.severity,
    channels: t.channels,
    metadata: t.metadata,
  };
}
