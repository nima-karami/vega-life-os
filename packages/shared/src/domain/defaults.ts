/** Every key of `defaults`, taken from `patch` unless it is null/undefined there. Keys
 *  the defaults don't name are dropped. */
export function fillDefaults<T extends object>(patch: Partial<T>, defaults: T): T {
  const filled = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    filled[key] = patch[key] ?? defaults[key];
  }
  return filled;
}
