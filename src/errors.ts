/**
 * Error trees: the nested `{ _errors: string[] }` shape that mirrors the
 * values, how it is built from schema issues, and how it is read.
 */
import { ZodType } from 'zod';
import { Errors } from './types';

/**
 * Builds the nested errors object from a list of issues. Produces the same
 * shape as Zod's `error.format()`, but only depends on `issues`, so it works
 * with any Zod major version.
 */
export function formatIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[]
): Errors<any> | undefined {
  if (issues.length === 0) return undefined;
  const root: any = { _errors: [] };
  for (const issue of issues) {
    let node = root;
    for (const segment of issue.path) {
      const key = String(segment);
      if (!node[key]) node[key] = { _errors: [] };
      node = node[key];
    }
    node._errors.push(issue.message);
  }
  return root;
}

/**
 * Runs the schema against the values and returns an errors tree, or undefined
 * when valid or when there is no schema.
 */
export function validateValues(
  schema: ZodType<any> | undefined,
  values: unknown
): Errors<any> | undefined {
  if (!schema) return undefined;
  const result = schema.safeParse(values);
  if (result.success) return undefined;
  return formatIssues(result.error.issues);
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
