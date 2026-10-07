/**
 * Validation is pluggable through Standard Schema (https://standardschema.dev),
 * the interface Zod, Valibot, ArkType, Effect Schema and others implement. The
 * types below are the spec, copied in as it recommends, so no schema library
 * is a dependency. `createSchema` wraps any validation function in it.
 */

/** A path segment in an issue: a key, or an object carrying the key. */
export type SchemaPathSegment = PropertyKey | { readonly key: PropertyKey };

/** One validation problem: a message and the path to the offending value. */
export interface SchemaIssue {
  readonly message: string;
  readonly path?: readonly SchemaPathSegment[] | undefined;
}

/** What `validate` returns: the (possibly transformed) value, or issues. */
export type SchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly SchemaIssue[] };

/** The Standard Schema V1 interface. */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown
    ) => SchemaResult<Output> | Promise<SchemaResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output };
  };
}

/** A schema `withForm` can validate values of type T with. */
export type FormSchema<T> = StandardSchema<any, T>;

/** The output type of a schema. */
export type InferSchemaOutput<S extends StandardSchema> = NonNullable<
  S['~standard']['types']
>['output'];

/** An issue as `createSchema` validators report it: the path may be a string. */
export interface ValidationIssue {
  readonly message: string;
  /** `'user.name'`, `['user', 'name']`, or omitted for the whole form. */
  readonly path?: string | readonly PropertyKey[] | undefined;
}

/**
 * Wraps a plain validation function in a schema `withForm` accepts. The
 * function receives the values and returns the issues it found, or nothing
 * when they are valid. Use it for custom rules, JSON Schema validators such
 * as Ajv, or errors a server returned.
 *
 * ```ts
 * const schema = createSchema<UserForm>((values) => [
 *   ...(values.name ? [] : [{ path: 'name', message: 'Name required' }]),
 * ]);
 * ```
 */
export function createSchema<T>(
  validate: (values: T) => readonly ValidationIssue[] | undefined | void
): StandardSchema<T, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'zustorm',
      validate: (value) => {
        const issues = validate(value as T);
        return issues && issues.length > 0
          ? {
              issues: issues.map((issue) => ({
                message: issue.message,
                path:
                  typeof issue.path === 'string'
                    ? issue.path.split('.')
                    : issue.path,
              })),
            }
          : { value: value as T };
      },
    },
  };
}
