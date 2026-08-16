import type { ServiceCardProps } from '../types';

/**
 * ServiceStatusCard — displays a single service's health status.
 *
 * Shows an animated dot indicator, service name/description, and the
 * raw response data when available. Transitions smoothly between states.
 */
export default function ServiceStatusCard({
  name,
  description,
  status,
  responseData,
}: ServiceCardProps) {
  const statusConfig = {
    checking: {
      color: 'bg-amber-400',
      ring: 'ring-amber-400/30',
      label: 'Checking…',
      labelColor: 'text-amber-400',
      pulse: true,
    },
    online: {
      color: 'bg-emerald-400',
      ring: 'ring-emerald-400/30',
      label: 'Online',
      labelColor: 'text-emerald-400',
      pulse: false,
    },
    unreachable: {
      color: 'bg-red-400',
      ring: 'ring-red-400/30',
      label: 'Unreachable',
      labelColor: 'text-red-400',
      pulse: false,
    },
  };

  const cfg = statusConfig[status];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.05]">
      {/* Subtle gradient glow on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative">
        {/* Header: name + status */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{name}</h3>
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5`}>
              {cfg.pulse && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.color} opacity-75`}
                />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${cfg.color} ring-4 ${cfg.ring}`}
              />
            </span>
            <span className={`text-sm font-medium ${cfg.labelColor}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm text-zinc-400">{description}</p>

        {/* Response data (shown when online) */}
        {responseData && status === 'online' && (
          <div className="rounded-lg bg-black/30 p-3 font-mono text-xs text-zinc-400">
            <pre className="overflow-x-auto">
              {JSON.stringify(responseData, null, 2)}
            </pre>
          </div>
        )}

        {/* Error state */}
        {status === 'unreachable' && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
            Could not connect — is the service running?
          </div>
        )}
      </div>
    </div>
  );
}
