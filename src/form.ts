/**
 * `withForm`: the store enhancer that validates, tracks touched/dirty state,
 * derives flags and attaches the form actions. Plus the standalone helpers
 * that call those actions on a store.
 */
import { getUntracked } from 'proxy-compare';
import { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';
import { createComputer } from './computer';
import {
  hasErrors,
  parseSetErrorArgs,
  setErrorMessages,
  validateValues,
} from './errors';
import { UNTRACKED_UPDATE, UntrackedUpdate } from './internal';
import { FormSchema } from './schema';
import {
  buildTouched,
  findChangedPaths,
  getPath,
  hasFlag,
  markPath,
  setIn,
  shareStructure,
  toPath,
} from './paths';
import {
  BaseFormState,
  DeepKeys,
  DeepValue,
  EnhancedForm,
  Errors,
  FormActions,
  FormComputed,
  FormInput,
  FormInputOf,
  FormState,
  ResetOptions,
  SubmitHandler,
  WithFormState,
} from './types';

/** Derives the `isDirty`, `isTouched` and `isValid` flags from form data. */
export function computeFlags(form: BaseFormState<any>): FormComputed {
  return {
    isDirty: hasFlag(form.dirty, '_dirty'),
    isTouched: hasFlag(form.touched, '_touched'),
    isValid: !hasErrors(form.errors),
  };
}

/** Builds the `handleSubmit` handler shared by root and scoped actions. */
export function createSubmitHandler<T>(
  form: {
    touchAll: () => void;
    validate: () => boolean;
    getState: () => BaseFormState<T>;
    setSubmitting: (isSubmitting: boolean) => void;
  },
  onValid: (values: T) => void | Promise<void>,
  onInvalid?: (errors: Errors<T>) => void | Promise<void>
): SubmitHandler {
  return async (event) => {
    event?.preventDefault?.();
    form.setSubmitting(true);
    try {
      form.touchAll();
      const valid = form.validate();
      const state = form.getState();
      if (valid) await onValid(state.values);
      else await onInvalid?.(state.errors as Errors<T>);
    } finally {
      form.setSubmitting(false);
    }
  };
}

/** Unwraps a proxy-compare proxy, returning the plain object underneath. */
function untrack<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  return (getUntracked(value as object) as T | null) ?? value;
}

/**
 * Shallow check for changes to root keys other than the one holding the form.
 * Reads the untracked state so this does not widen the computer's dependency
 * tracking to the whole store.
 */
function changedOutsideForm(
  state: object,
  prevState: object | undefined,
  formKey: string | undefined
): boolean {
  if (!formKey || !prevState) return false;
  const raw = untrack(state) as Record<string, unknown>;
  const prev = prevState as Record<string, unknown>;
  for (const key in raw) {
    if (key !== formKey && !Object.is(raw[key], prev[key])) return true;
  }
  for (const key in prev) {
    if (key !== formKey && !(key in raw)) return true;
  }
  return false;
}

type Mutators = [StoreMutatorIdentifier, unknown][];
type ValuesOf<F> = F extends { values: infer T } ? T : never;
type ValuesAt<S, K> = [K] extends [undefined]
  ? ValuesOf<S>
  : ValuesOf<DeepValue<S, Extract<K, DeepKeys<S>>>>;

/**
 * The context-driven overload infers the store type from the contextual type
 * alone (`create<Store>()(withForm(...))`). Without a context the type
 * parameter falls back to its constraint `object`; this guard then turns the
 * creator's expected return into `never` so the inferring overloads get their
 * turn.
 */
type Inferred<S> = object extends S ? never : unknown;

/**
 * Rejects a function where initial values are expected. Done structurally so
 * the check happens before contextual typing, which keeps this overload from
 * fixing a creator's `set`/`get` parameters while the others are being tried.
 */
type NotAFunction = { call?: never; apply?: never; bind?: never };

/** `formPath` is optional only when the store itself is the form. */
type FormPathOption<S, K> =
  S extends FormActions<any> ? { formPath?: K } : { formPath: K };

/** `withForm` options for a store that is itself the form. */
export type WithFormOptions<S, T> = {
  /**
   * Returns the schema to validate the values with: anything implementing
   * Standard Schema (Zod, Valibot, ArkType, ...) or `createSchema(...)`.
   * Receives the whole store state.
   */
  getSchema?: (state: S) => FormSchema<T> | undefined;
};

/** `withForm` options for a form living at `formPath` inside a larger store. */
export type WithFormAtOptions<S, T, K> = WithFormOptions<S, T> & {
  /** The path to the form within the store. */
  formPath: K;
};

/**
 * Enhances a Zustand store creator with form management: validation, touched
 * and dirty tracking, derived flags and the form actions.
 *
 * Three ways to call it:
 * - `withForm(initialValues, options?)` for a store that is the form.
 * - `withForm(() => ({ values }), options?)` with a creator returning the form
 *   data (`values`, and optionally `initialValues`, `errors`, `touched`,
 *   `dirty`) plus anything else you want on the store.
 * - `withForm(() => ({ form: { values }, ...rest }), { formPath: 'form' })`
 *   for a form nested inside a larger store.
 *
 * The creator returns the plain form data; the resulting store state carries
 * the flags and actions, typed as `FormState`. A creator that uses `set` or
 * `get` needs the store type declared up front, `create<State>()(withForm(...))`,
 * the same rule Zustand applies to its own middleware; `set` and `get` then
 * see the enhanced state.
 */
// Store type known from context (curried `create<State>()`), form at the root or at `formPath`.
export function withForm<
  S extends object,
  K extends DeepKeys<S> | undefined = undefined,
  Mps extends Mutators = [],
  Mcs extends Mutators = [],
>(
  creator: StateCreator<
    S,
    [...Mps],
    Mcs,
    FormInputOf<NoInfer<S>> & Inferred<NoInfer<S>>
  >,
  options?: WithFormOptions<S, ValuesAt<S, K>> & FormPathOption<S, K>
): StateCreator<S, Mps, [...Mcs]>;
// Store type inferred from a creator returning the form data at the root.
export function withForm<
  I extends BaseFormState<any>,
  Mps extends Mutators = [],
  Mcs extends Mutators = [],
>(
  creator: StateCreator<EnhancedForm<I>, [...Mps], Mcs, I>,
  options?: WithFormOptions<EnhancedForm<I>, I['values']>
): StateCreator<EnhancedForm<I>, Mps, [...Mcs]>;
// Store type inferred from a creator with the form data at `formPath`.
export function withForm<
  I extends object,
  const K extends DeepKeys<I>,
  Mps extends Mutators = [],
  Mcs extends Mutators = [],
>(
  creator: StateCreator<WithFormState<I, K>, [...Mps], Mcs, I>,
  options: WithFormAtOptions<WithFormState<I, K>, ValuesOf<DeepValue<I, K>>, K>
): StateCreator<WithFormState<I, K>, Mps, [...Mcs]>;
// Initial values instead of a creator.
export function withForm<
  T extends object,
  Mps extends Mutators = [],
  Mcs extends Mutators = [],
>(
  initialValues: T & NotAFunction,
  options?: WithFormOptions<FormState<T>, T>
): StateCreator<FormState<T>, Mps, [...Mcs]>;
export function withForm(
  creatorOrValues: StateCreator<any, any, any> | object,
  options?: {
    formPath?: DeepKeys<any>;
    getSchema?: (state: any) => FormSchema<any> | undefined;
  }
): StateCreator<any, any, any> {
  const creator: StateCreator<any, any, any> =
    typeof creatorOrValues === 'function'
      ? (creatorOrValues as StateCreator<any, any, any>)
      : () => getDefaultForm(creatorOrValues);
  return createFormEnhancer<any>(
    options?.formPath,
    options?.getSchema
  )(creator);
}

function createFormEnhancer<S extends object>(
  formPath: DeepKeys<any> | undefined,
  getSchema: ((state: S) => FormSchema<any> | undefined) | undefined
) {
  const segments = toPath(formPath);
  const formKey = segments[0];
  const readForm = (state: unknown) =>
    getPath(state, segments) as FormState<any> | undefined;
  /** Immutable write of the form object back into the root state. */
  const writeForm = (state: any, form: unknown): Partial<S> => {
    if (segments.length === 0) return form as Partial<S>;
    const next = setIn(state, segments, form);
    return { [formKey]: next[formKey] } as Partial<S>;
  };

  return (creator: StateCreator<S, any, any>) => {
    let suppressTracking = false;
    const untracked: UntrackedUpdate = (update) => {
      const previous = suppressTracking;
      suppressTracking = true;
      try {
        update();
      } finally {
        suppressTracking = previous;
      }
    };

    const withActions: StateCreator<S, any, any> = (set, get, api) => {
      Object.assign(api, { [UNTRACKED_UPDATE]: untracked });
      const initialState = creator(set, get, api);
      const initialForm = readForm(initialState);
      if (!initialForm) return initialState;

      const initialValues = initialForm.initialValues ?? initialForm.values;

      const updateForm = (
        recipe: (form: BaseFormState<any>) => Partial<FormState<any>>
      ) =>
        set((state: S) => {
          const form = readForm(state);
          if (!form) return {};
          return writeForm(state, { ...form, ...recipe(form) });
        });

      const actions: FormActions<any> = {
        reset: (values, resetOptions) =>
          untracked(() =>
            updateForm((form) => ({
              values:
                values === undefined
                  ? (form.initialValues ?? initialValues)
                  : values,
              initialValues:
                values === undefined || resetOptions?.keepInitialValues
                  ? form.initialValues
                  : values,
              errors: undefined,
              touched: undefined,
              dirty: undefined,
            }))
          ),
        resetTouched: () => updateForm(() => ({ touched: undefined })),
        resetDirty: () => updateForm(() => ({ dirty: undefined })),
        resetErrors: () => updateForm(() => ({ errors: undefined })),
        setErrors: (errors) => updateForm(() => ({ errors })),
        setError: (...args: unknown[]) => {
          const [path, message] = parseSetErrorArgs(args);
          updateForm((form) => ({
            errors: setErrorMessages(form.errors, toPath(path as any), message),
          }));
        },
        touchAll: () =>
          updateForm((form) => ({ touched: buildTouched(form.values) })),
        validate: () => {
          const state = get();
          const form = readForm(state);
          if (!form) return true;
          const errors = validateValues(getSchema?.(state), form.values);
          updateForm(() => ({ errors }));
          return !errors;
        },
        handleSubmit: (onValid, onInvalid) =>
          createSubmitHandler(
            {
              touchAll: () => actions.touchAll(),
              validate: () => actions.validate(),
              getState: () => readForm(get()) as FormState<any>,
              setSubmitting: (isSubmitting) =>
                updateForm(() => ({ isSubmitting })),
            },
            onValid,
            onInvalid
          ),
      };

      // Attach the actions to the form object only, never to the root of a
      // larger store, so they cannot shadow the user's own root actions.
      const form = {
        ...initialForm,
        initialValues,
        isSubmitting: false,
        ...actions,
      };
      return segments.length === 0 ? form : setIn(initialState, segments, form);
    };

    const compute = (state: S, prevState: S, external: boolean): Partial<S> => {
      const schema = getSchema?.(state);

      // Read the form through the tracked proxy so the computer re-runs when
      // one of these keys changes, then unwrap to plain objects: everything
      // below runs on raw data, never on proxies.
      const trackedForm = readForm(state);
      if (!trackedForm) return {};
      const form: BaseFormState<any> = {
        values: untrack(trackedForm.values),
        initialValues: untrack(trackedForm.initialValues),
        errors: untrack(trackedForm.errors),
        touched: untrack(trackedForm.touched),
        dirty: untrack(trackedForm.dirty),
      };
      const rawForm = untrack(trackedForm) as FormState<any>;
      const prevForm = readForm(prevState);

      const previousValues = prevForm?.values;
      // A reset, or state written past the store api (persist hydration,
      // devtools), is adopted as is: validated, but not marked touched or dirty.
      const resetRequested = suppressTracking || external;
      const changedPaths = Object.is(previousValues, form.values)
        ? []
        : findChangedPaths(previousValues, form.values);
      const valuesChanged = !prevForm || changedPaths.length > 0;

      let { touched, dirty } = form;
      if (!resetRequested && previousValues && changedPaths.length > 0) {
        for (const changed of changedPaths) {
          const changedSegments = toPath(changed);
          touched = markPath(touched, changedSegments, '_touched');
          dirty = markPath(dirty, changedSegments, '_dirty');
        }
      }

      // Errors are recomputed when the values change, on a reset, or when state
      // outside the form changes (a schema may depend on it). Otherwise they are
      // kept so `resetErrors` and `validate` results hold until the next edit.
      // Unchanged error nodes keep their identity so untouched fields do not
      // re-render.
      const shouldValidate =
        !prevForm ||
        valuesChanged ||
        resetRequested ||
        changedOutsideForm(state, prevState, formKey);
      const errors = shouldValidate
        ? shareStructure(form.errors, validateValues(schema, form.values))
        : form.errors;

      const nextForm = { ...rawForm, touched, dirty, errors };
      return writeForm(untrack(state), {
        ...nextForm,
        ...computeFlags(nextForm),
      });
    };

    return createComputer<S>(compute)(withActions);
  };
}

/**
 * Returns `{ values, initialValues }` for the supplied values.
 *
 * @deprecated `withForm` accepts the initial values directly, or a creator
 * returning `{ values }`:
 * ```ts
 * create(withForm(initialValues, { getSchema }));
 * create(withForm(() => ({ values: initialValues, extra: 0 }), { getSchema }));
 * ```
 */
export function getDefaultForm<T extends object>(values: T): FormInput<T> {
  return { values, initialValues: values };
}

// ---------------------------------------------------------------------------
// Standalone helpers: the store actions, callable with a store reference.
// ---------------------------------------------------------------------------

/** Reset a form store to its initial values, or to the values supplied. */
export function resetForm<T>(
  store: StoreApi<FormState<T>>,
  values?: T,
  options?: ResetOptions
): void {
  store.getState().reset(values, options);
}

/** Clear all touched state from a form store. */
export function resetTouched<T>(store: StoreApi<FormState<T>>): void {
  store.getState().resetTouched();
}

/** Clear all dirty state from a form store. */
export function resetDirty<T>(store: StoreApi<FormState<T>>): void {
  store.getState().resetDirty();
}

/** Clear all validation errors from a form store. */
export function resetErrors<T>(store: StoreApi<FormState<T>>): void {
  store.getState().resetErrors();
}

/** Replace the errors of a form store, for example with errors a server returned. */
export function setErrors<T>(
  store: StoreApi<FormState<T>>,
  errors: Errors<T> | undefined
): void {
  store.getState().setErrors(errors);
}

/** Set the messages of one field in a form store, or of the form with no path. */
export function setError<T>(
  store: StoreApi<FormState<T>>,
  message: string | string[]
): void;
export function setError<T>(
  store: StoreApi<FormState<T>>,
  path: DeepKeys<T>,
  message: string | string[]
): void;
export function setError<T>(
  store: StoreApi<FormState<T>>,
  ...args: unknown[]
): void {
  (store.getState().setError as (...a: unknown[]) => void)(...args);
}

/** Mark every field in a form store as touched. */
export function touchAll<T>(store: StoreApi<FormState<T>>): void {
  store.getState().touchAll();
}

/** Re-run validation on a form store and return whether it is valid. */
export function validateForm<T>(store: StoreApi<FormState<T>>): boolean {
  return store.getState().validate();
}

/** Build a submit handler for a form store. */
export function handleSubmit<T>(
  store: StoreApi<FormState<T>>,
  onValid: (values: T) => void | Promise<void>,
  onInvalid?: (errors: Errors<T>) => void | Promise<void>
): SubmitHandler {
  return store.getState().handleSubmit(onValid, onInvalid);
}
