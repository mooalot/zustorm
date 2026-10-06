/**
 * `withForm`: the store enhancer that validates, tracks touched/dirty state,
 * derives flags and attaches the form actions. Plus the standalone helpers
 * that call those actions on a store.
 */
import { getUntracked } from 'proxy-compare';
import { ZodType } from 'zod';
import {
  createStore,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
} from 'zustand';
import { createComputer } from './computer';
import { hasErrors, validateValues } from './errors';
import { UNTRACKED_UPDATE, UntrackedUpdate } from './internal';
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
  Errors,
  FormActions,
  FormComputed,
  FormState,
  ResetOptions,
  SubmitHandler,
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
  },
  onValid: (values: T) => void | Promise<void>,
  onInvalid?: (errors: Errors<T>) => void | Promise<void>
): SubmitHandler {
  return async (event) => {
    event?.preventDefault?.();
    form.touchAll();
    const valid = form.validate();
    const state = form.getState();
    if (valid) await onValid(state.values);
    else await onInvalid?.(state.errors as Errors<T>);
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

type WithFormOptions<T, K> =
  T extends FormState<any>
    ? {
        formPath?: K;
        getSchema?: (
          state: T
        ) => ZodType<T extends FormState<infer U> ? U : never>;
      }
    : K extends DeepKeys<T>
      ? {
          formPath: K;
          getSchema?: (
            state: T
          ) => ZodType<DeepValue<T, K> extends FormState<infer U> ? U : never>;
        }
      : never;

/**
 * A higher-order function that enhances a Zustand store creator with form management capabilities.
 * Automatically adds form validation, error handling, and state computation to your store.
 *
 * @param creator - The Zustand store creator function
 * @param options - Configuration options including formPath and schema validation
 * @param options.formPath - The path to the form within the store (required when store state is not directly a FormState)
 * @param options.getSchema - Function to get the Zod schema for form validation
 * @returns An enhanced store creator with form management
 */
export const withForm = <
  T extends object,
  const K extends DeepKeys<T> | undefined = undefined,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
  S extends object = T,
>(
  creator: StateCreator<T, [...Mps], Mcs>,
  options: WithFormOptions<T, K>
): StateCreator<S, Mps, [...Mcs]> => {
  const { formPath, getSchema } = (options || {}) as {
    formPath?: DeepKeys<any>;
    getSchema?: (state: S) => ZodType<any> | undefined;
  };
  return createFormEnhancer<S>(
    formPath,
    getSchema
  )(creator as unknown as StateCreator<S, any, any>) as StateCreator<
    S,
    Mps,
    [...Mcs]
  >;
};

function createFormEnhancer<S extends object>(
  formPath: DeepKeys<any> | undefined,
  getSchema: ((state: S) => ZodType<any> | undefined) | undefined
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
        recipe: (form: BaseFormState<any>) => Partial<BaseFormState<any>>
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
            },
            onValid,
            onInvalid
          ),
      };

      // Attach the actions to the form object only, never to the root of a
      // larger store, so they cannot shadow the user's own root actions.
      const form = { ...initialForm, initialValues, ...actions };
      return segments.length === 0 ? form : setIn(initialState, segments, form);
    };

    const compute = (state: S, prevState: S): Partial<S> => {
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
      const resetRequested = suppressTracking;
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
 * Creates a default form state object with the provided initial values.
 *
 * @param values - The initial values for the form
 * @returns A FormState object with default properties
 */
export function getDefaultForm<T extends object>(values: T): FormState<T> {
  return { values, initialValues: values } as FormState<T>;
}

/**
 * @deprecated Use `createStore` with `withForm` instead:
 * ```ts
 * const store = createStore<FormState<T>>()(
 *   withForm(() => getDefaultForm(initialValue), { getSchema })
 * );
 * ```
 */
export const createFormStore = <T extends object>(
  initialValue: T,
  options?: {
    /** The function to get the schema for the form. */
    getSchema?: (state: FormState<T>) => ZodType<T>;
  }
) => {
  return createStore<FormState<T>>()(
    withForm(() => getDefaultForm(initialValue), {
      getSchema: options?.getSchema,
    })
  );
};

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
