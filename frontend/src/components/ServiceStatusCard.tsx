import type { ServiceCardProps } from '../types';
import { Card } from './ui/Card';
import { StatusDot } from './ui/StatusDot';

/**
 * ServiceStatusCard — displays a single service's health status.
 *
 * Status colors come from the shared <StatusDot /> so the indicator style
 * matches every other status pill in the app.  Light/dark parity via Card.
 */
export default function ServiceStatusCard({
  name,
  description,
  status,
  responseData,
}: ServiceCardProps) {
  const statusToKind = {
    checking: 'checking',
    online: 'online',
    unreachable: 'failed',
  } as const;

  const statusToLabel = {
    checking: 'Checking…',
    online: 'Online',
    unreachable: 'Unreachable',
  } as const;

  return (
    <Card tone="subtle" padding="lg" className="group relative overflow-hidden transition-colors duration-150 hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{name}</h3>
        <StatusDot status={statusToKind[status]} label={statusToLabel[status]} />
      </div>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans-ui">
        {description}
      </p>
      {responseData && status === 'online' && (
        <pre className="rounded-[var(--radius-sm)] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 font-code text-[11px] text-zinc-700 dark:text-zinc-400 overflow-x-auto">
          {JSON.stringify(responseData, null, 2)}
        </pre>
      )}
      {status === 'unreachable' && (
        <div className="rounded-[var(--radius-sm)] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
          Could not connect — is the service running?
        </div>
      )}
    </Card>
  );
}