/**
 * Error trees: the nested `{ _errors: string[] }` shape that mirrors the
 * values, how it is built from schema issues, and how it is read.
 */
import { getPath } from './paths';
import { SchemaIssue, StandardSchema } from './schema';
import { Errors } from './types';

/**
 * Builds the nested errors object from a list of issues, the same shape as
 * Zod's `error.format()`. Accepts the issues of any Standard Schema, whose
 * path segments may be keys or `{ key }` objects.
 */
export function formatIssues(
  issues: readonly SchemaIssue[]
): Errors<any> | undefined {
  if (issues.length === 0) return undefined;
  const root: any = { _errors: [] };
  for (const issue of issues) {
    let node = root;
    for (const segment of issue.path ?? []) {
      const key = String(
        typeof segment === 'object' && segment !== null ? segment.key : segment
      );
      if (!node[key]) node[key] = { _errors: [] };
      node = node[key];
    }
    node._errors.push(issue.message);
  }
  return root;
}

/**
 * Runs the schema against the values and returns an errors tree, or undefined
 * when valid or when there is no schema. Validation is synchronous: a schema
 * with async rules is rejected rather than silently treated as valid.
 */
export function validateValues(
  schema: StandardSchema | undefined,
  values: unknown
): Errors<any> | undefined {
  if (!schema) return undefined;
  const result = schema['~standard'].validate(values);
  if (result instanceof Promise) {
    throw new Error(
      'zustorm: the schema validates asynchronously, which withForm does not support'
    );
  }
  if (!result.issues) return undefined;
  return formatIssues(result.issues);
}

/** True if any node in an errors tree has at least one message. */
export function hasErrors(errors: unknown): boolean {
  if (!errors || typeof errors !== 'object') return false;
  for (const key in errors as object) {
    const value = (errors as any)[key];
    if (key === '_errors') {
      if (Array.isArray(value) && value.length > 0) return true;
    } else if (hasErrors(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Collects every message in an errors tree: the node's own messages first,
 * then its descendants' messages depth-first. Returns an empty array when
 * there are none, so it is safe to call on `undefined`.
 */
export function getErrorMessages(errors: unknown): string[] {
  if (!errors || typeof errors !== 'object') return [];
  const messages: string[] = [];
  const own = (errors as { _errors?: unknown })._errors;
  if (Array.isArray(own)) messages.push(...own);
  for (const key in errors as object) {
    if (key !== '_errors') {
      messages.push(...getErrorMessages((errors as any)[key]));
    }
  }
  return messages;
}

/** The first message in an errors tree, or undefined when it is valid. */
export function getErrorMessage(errors: unknown): string | undefined {
  return getErrorMessages(errors)[0];
}

function isNode(value: unknown): value is Record<string, any> {
  return value != null && typeof value === 'object';
}

/**
 * Immutably writes `node` at `segments` in an errors tree, creating missing
 * ancestors with an empty `_errors`. Writing undefined removes the entry.
 */
export function setErrorNode(
  errors: unknown,
  segments: readonly string[],
  node: unknown
): any {
  if (segments.length === 0) return node;
  const base = isNode(errors) ? errors : { _errors: [] };
  const [head, ...rest] = segments;
  if (rest.length === 0 && node === undefined) {
    const others = { ...base };
    delete others[head];
    return others;
  }
  return { ...base, [head]: setErrorNode(base[head], rest, node) };
}

/**
 * Sets the messages at `segments` in an errors tree, keeping the node's
 * children and every other error.
 */
export function setErrorMessages(
  errors: unknown,
  segments: readonly string[],
  message: string | readonly string[]
): any {
  const node = getPath(errors, segments);
  return setErrorNode(errors, segments, {
    ...(isNode(node) ? node : {}),
    _errors: typeof message === 'string' ? [message] : [...message],
  });
}

/**
 * Overlays manually set errors on the schema's errors. Where a manual node has
 * messages of its own they replace the schema's at that node; everything else
 * is merged. Returns undefined when the result holds no messages.
 */
export function mergeErrors(schema: unknown, manual: unknown): any {
  if (!hasErrors(manual)) return schema;
  const merge = (a: unknown, b: unknown): any => {
    if (!isNode(b)) return a;
    const base = isNode(a) ? a : { _errors: [] };
    const result: Record<string, any> = { ...base };
    const own = b._errors;
    if (Array.isArray(own) && own.length > 0) result._errors = [...own];
    for (const key in b) {
      if (key !== '_errors' && hasErrors(b[key])) {
        result[key] = merge(base[key], b[key]);
      }
    }
    return result;
  };
  return merge(schema, manual);
}

/**
 * Removes the manual errors a value change at `segments` invalidates: the
 * subtree at that path and the own messages of every ancestor (the form's
 * among them), since those fields changed too.
 */
export function dropErrorsAt(
  errors: unknown,
  segments: readonly string[]
): any {
  if (!isNode(errors)) return errors;
  const own = errors._errors;
  let next: Record<string, any> = errors;
  if (Array.isArray(own) && own.length > 0) next = { ...next, _errors: [] };
  if (segments.length === 0) return undefined;
  const [head, ...rest] = segments;
  if (!(head in next)) return next;
  const child = rest.length === 0 ? undefined : dropErrorsAt(next[head], rest);
  if (child === next[head]) return next;
  next = next === errors ? { ...next } : next;
  if (child === undefined) delete next[head];
  else next[head] = child;
  return next;
}

/** Splits `setError`'s overloaded arguments into a path and a message. */
export function parseSetErrorArgs(
  args: readonly unknown[]
): [path: unknown, message: string | readonly string[]] {
  return args.length > 1
    ? [args[0], args[1] as string | readonly string[]]
    : [undefined, args[0] as string | readonly string[]];
}
