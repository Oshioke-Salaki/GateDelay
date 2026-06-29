import { NotificationType } from './notification.entity';

interface Template {
  title: (data?: Record<string, unknown>) => string;
  body: (data?: Record<string, unknown>) => string;
  emailHtml: (data?: Record<string, unknown>) => string;
}

export const TEMPLATES: Record<NotificationType, Template> = {
  trade_confirmation: {
    title: () => 'Trade Confirmed',
    body: (d) => `Your trade on "${d?.market ?? 'market'}" was confirmed. Amount: ${d?.amount ?? '—'}`,
    emailHtml: (d) =>
      `<p>Your trade on <strong>${d?.market ?? 'market'}</strong> has been confirmed.</p><p>Amount: ${d?.amount ?? '—'}</p>`,
  },
  market_update: {
    title: (d) => `Market Update: ${d?.market ?? ''}`,
    body: (d) => `${d?.message ?? 'A market you follow has been updated.'}`,
    emailHtml: (d) =>
      `<p><strong>${d?.market ?? 'A market'}</strong> has been updated.</p><p>${d?.message ?? ''}</p>`,
  },
  price_alert: {
    title: (d) => `Price Alert: ${d?.market ?? ''}`,
    body: (d) => `Price moved to ${d?.price ?? '—'} (${d?.change ?? ''})`,
    emailHtml: (d) =>
      `<p>Price alert triggered for <strong>${d?.market ?? 'market'}</strong>.</p><p>Current price: ${d?.price ?? '—'} (${d?.change ?? ''})</p>`,
  },
  system: {
    title: () => 'System Notification',
    body: (d) => `${d?.message ?? 'A system event occurred.'}`,
    emailHtml: (d) => `<p>${d?.message ?? 'A system event occurred.'}</p>`,
  },
  weekly_digest: {
    title: () => 'Your Weekly GateDelay Digest',
    body: (d) => `You had ${d?.trades ?? 0} trades this week. P&L: ${d?.pnl ?? '—'}`,
    emailHtml: (d) =>
      `<h2>Weekly Digest</h2><p>Trades: ${d?.trades ?? 0}</p><p>P&amp;L: ${d?.pnl ?? '—'}</p>`,
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
  };
}
