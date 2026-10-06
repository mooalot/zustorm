/**
 * Hidden store method installed by `withForm`. Runs an update with touched/dirty
 * tracking suppressed, so a reset does not mark the fields it restores as dirty.
 * Scoped APIs forward it so a reset from any scope reaches the owning computer.
 */
export const UNTRACKED_UPDATE = Symbol('zustorm.untrackedUpdate');

export type UntrackedUpdate = (update: () => void) => void;

/** Runs `update` without touched/dirty tracking when the store supports it. */
export function runUntracked(store: object, update: () => void): void {
  const untracked = (store as any)[UNTRACKED_UPDATE] as
    UntrackedUpdate | undefined;
  if (untracked) untracked(update);
  else update();
}

/** Copies the hidden untracked-update hook from one store api to another. */
export function forwardUntracked<T extends object>(from: object, to: T): T {
  return Object.assign(to, {
    [UNTRACKED_UPDATE]: (from as any)[UNTRACKED_UPDATE],
  });
}
