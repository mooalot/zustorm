/**
 * Path and tree helpers. Everything here is immutable: containers on the
 * written path are cloned, everything else keeps its identity. That identity
 * is what the scoped subscriptions and React compare against.
 */
import { DeepKeys } from './types';

/** Splits a path like `a.b[0].c` (or an array path) into string segments. */
export function toPath(path: DeepKeys<any> | string | undefined): string[] {
  if (path === undefined || path === null) return [];
  if (Array.isArray(path)) return path.map(String);
  const segments: string[] = [];
  const text = String(path);
  const matcher = /[^.[\]]+|\[(?:(-?\d+)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    segments.push(match[1] ?? match[3] ?? match[0]);
  }
  return segments;
}

/** Reads a value at `segments`, or undefined when any container is missing. */
export function getPath(obj: unknown, segments: readonly string[]): any {
  let current: any = obj;
  for (let i = 0; i < segments.length; i++) {
    if (current == null) return undefined;
    current = current[segments[i]];
  }
  return current;
}

function isContainer(value: unknown): value is Record<string, any> {
  return value != null && typeof value === 'object';
}

function clone(value: unknown): any {
  return Array.isArray(value)
    ? [...value]
    : { ...(isContainer(value) ? value : {}) };
}

/**
 * Immutable set along `segments`, cloning only the containers on the path.
 * Missing containers are created as objects. Returns the same root when the
 * value is already in place.
 */
export function setIn(
  root: any,
  segments: readonly string[],
  value: unknown
): any {
  if (segments.length === 0) return value;
  const [head, ...rest] = segments;
  const child = isContainer(root) ? root[head] : undefined;
  const nextChild = setIn(child, rest, value);
  if (isContainer(root) && Object.is(child, nextChild)) return root;
  const next = clone(root);
  next[head] = nextChild;
  return next;
}

/** True if any node in a touched/dirty tree carries the flag. */
export function hasFlag(tree: unknown, flag: string): boolean {
  if (!isContainer(tree)) return false;
  for (const key in tree) {
    const value = tree[key];
    if (key === flag) {
      if (value) return true;
    } else if (hasFlag(value, flag)) {
      return true;
    }
  }
  return false;
}

/**
 * Marks every node on the path (not the root) with `flag`. Already-marked
 * nodes keep their identity, so repeated edits to one field allocate nothing.
 */
export function markPath(
  tree: any,
  segments: readonly string[],
  flag: string,
  index = 0
): any {
  if (index >= segments.length) return tree;
  const key = segments[index];
  const child = isContainer(tree) ? tree[key] : undefined;
  const marked = markPath(child, segments, flag, index + 1);
  const nextChild = isContainer(marked)
    ? marked[flag] === true
      ? marked
      : { ...marked, [flag]: true }
    : { [flag]: true };
  if (Object.is(child, nextChild)) return tree;
  return { ...(isContainer(tree) ? tree : {}), [key]: nextChild };
}

/**
 * Removes the flag subtree at `segments` and drops ancestor flags that no
 * longer have a flagged descendant. Returns undefined when nothing flagged
 * remains, so a cleared scope leaves `state.dirty` falsy.
 */
export function pruneFlags(
  tree: any,
  segments: readonly string[],
  flag: string,
  index = 0
): any {
  if (!isContainer(tree)) return tree;
  if (index === segments.length) return undefined;
  const key = segments[index];
  if (!(key in tree)) return tree;
  const nextChild = pruneFlags(tree[key], segments, flag, index + 1);
  if (Object.is(nextChild, tree[key])) return tree;
  const next: any = { ...tree };
  if (nextChild === undefined) delete next[key];
  else next[key] = nextChild;
  const childFlagged = Object.keys(next).some(
    (k) => k !== flag && hasFlag(next[k], flag)
  );
  if (!childFlagged) delete next[flag];
  if (Object.keys(next).length === 0) return undefined;
  return index === 0 && !hasFlag(next, flag) ? undefined : next;
}

/** Builds a touched tree with every node (including the root) marked. */
export function buildTouched(values: unknown): any {
  const node: any = { _touched: true };
  if (isContainer(values)) {
    for (const key in values) node[key] = buildTouched(values[key]);
  }
  return node;
}

/**
 * Recursively finds all leaf paths that differ between two objects. Compares by
 * reference first, so with structural sharing only the changed branch is
 * walked; deep-equal objects with different identities yield no paths.
 */
export function findChangedPaths(
  oldObj: any,
  newObj: any,
  currentPath: string = '',
  result: string[] = []
): string[] {
  if (Object.is(oldObj, newObj)) return result;

  if (
    !isContainer(oldObj) ||
    !isContainer(newObj) ||
    Array.isArray(oldObj) !== Array.isArray(newObj)
  ) {
    if (currentPath) result.push(currentPath);
    return result;
  }

  for (const key in newObj) {
    const keyPath = currentPath ? `${currentPath}.${key}` : key;
    findChangedPaths(oldObj[key], newObj[key], keyPath, result);
  }
  for (const key in oldObj) {
    if (!(key in newObj)) {
      result.push(currentPath ? `${currentPath}.${key}` : key);
    }
  }
  return result;
}

/**
 * Returns `next` with every subtree that is deep-equal to the matching subtree
 * of `prev` replaced by the `prev` reference, so unchanged parts keep identity.
 */
export function shareStructure<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) return next;
  if (
    !isContainer(prev) ||
    !isContainer(next) ||
    Array.isArray(prev) !== Array.isArray(next)
  ) {
    return next;
  }
  const keys = Object.keys(next);
  let same = keys.length === Object.keys(prev).length;
  const out: any = Array.isArray(next) ? [] : {};
  for (const key of keys) {
    const shared = shareStructure(prev[key], next[key]);
    out[key] = shared;
    if (!Object.is(shared, prev[key])) same = false;
  }
  return (same ? prev : out) as T;
}
