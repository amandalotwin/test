import { FlagRegistry } from './types';

/**
 * Central feature flag registry.
 *
 * Every feature flag in the application MUST be registered here with full
 * metadata. This makes it easy to audit, track, and clean up flags over time.
 *
 * Guidelines:
 * - Set `type: 'temporary'` for flags that gate a feature rollout and should
 *   eventually be removed once the feature is fully launched.
 * - Set `type: 'permanent'` for operational flags (e.g. maintenance mode,
 *   debug toggles) that are expected to stay indefinitely.
 * - Always set `expiresAt` for temporary flags. The audit script will flag
 *   any temporary flag past its expiration date.
 * - Use `owner` to identify who is responsible for cleaning up the flag.
 *
 * Example:
 * ```ts
 * EXAMPLE_FLAG: {
 *   value: true,
 *   metadata: {
 *     description: 'Enable the new dashboard layout',
 *     createdAt: '2026-01-15',
 *     owner: 'frontend-team',
 *     ticket: 'https://github.com/org/repo/issues/42',
 *     expiresAt: '2026-04-15',
 *     type: 'temporary',
 *   },
 * },
 * ```
 */
export const FLAGS: FlagRegistry = {
  // Register your feature flags below.
  // See the example above for the expected format.
};

/**
 * Type-safe flag accessor. Returns the flag value or a fallback default.
 */
export function getFlag<T = boolean>(
  name: string,
  defaultValue: T
): T {
  const flag = FLAGS[name];
  if (!flag) {
    return defaultValue;
  }
  return flag.value as T;
}

/**
 * Check if a flag is enabled (boolean flags only).
 */
export function isFlagEnabled(name: string): boolean {
  return getFlag(name, false);
}
