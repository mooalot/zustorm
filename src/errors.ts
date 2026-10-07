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
    const { [head]: _removed, ...others } = base;
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

/** Splits `setError`'s overloaded arguments into a path and a message. */
export function parseSetErrorArgs(
  args: readonly unknown[]
): [path: unknown, message: string | readonly string[]] {
  return args.length > 1
    ? [args[0], args[1] as string | readonly string[]]
    : [undefined, args[0] as string | readonly string[]];
}
