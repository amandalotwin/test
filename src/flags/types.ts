export interface FeatureFlagMetadata {
  /** Human-readable description of what this flag controls */
  description: string;
  /** ISO date string when the flag was created */
  createdAt: string;
  /** Team or person responsible for this flag */
  owner: string;
  /** Link to the ticket/PR that introduced this flag */
  ticket?: string;
  /** Expected removal date (ISO string). Flags past this date are considered stale. */
  expiresAt?: string;
  /** Whether this flag is temporary (feature rollout) or permanent (ops/config) */
  type: 'temporary' | 'permanent';
}

export interface FeatureFlag<T = boolean> {
  /** The current value of the flag */
  value: T;
  /** Metadata about this flag for tracking and cleanup */
  metadata: FeatureFlagMetadata;
}

export type FlagRegistry = Record<string, FeatureFlag>;

export interface StaleFlag {
  name: string;
  reason: string;
  metadata: FeatureFlagMetadata;
}
