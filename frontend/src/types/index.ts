/**
 * Shared TypeScript types used across the frontend.
 */

/** The possible states a service health check can be in. */
export type ServiceStatus = 'checking' | 'online' | 'unreachable';

/** Shape of the response from either health endpoint. */
export interface HealthResponse {
  status: string;
  service: string;
  timestamp?: string;
}

/** Props for the ServiceStatusCard component. */
export interface ServiceCardProps {
  name: string;
  description: string;
  status: ServiceStatus;
  responseData?: HealthResponse | null;
}
