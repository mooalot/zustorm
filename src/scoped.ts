/**
 * Scoped store APIs: a `StoreApi` view onto a path inside a larger store.
 * `getScopedApi` scopes any state; `getScopedFormApi` scopes a form, mapping
 * `values`, `errors`, `touched`, `dirty` and `initialValues` to the path and
 * providing scoped actions and flags.
 */
import { StoreApi } from 'zustand';
import {
  hasErrors,
  parseSetErrorArgs,
  setErrorMessages,
  setErrorNode,
} from './errors';
import { computeFlags, createSubmitHandler } from './form';
import { forwardUntracked, runUntracked } from './internal';
import {
  buildTouched,
  getPath,
  markPath,
  pruneFlags,
  setIn,
  toPath,
} from './paths';
import {
  AnyFunction,
  BaseFormState,
  DeepKeys,
  DeepValue,
  FormActions,
  FormComputed,
  FormState,
} from './types';

export function getScopedApi<
  S extends object,
  const K extends DeepKeys<S>,
  V = DeepValue<S, K>,
>(store: StoreApi<S>, path: K): StoreApi<V> {
  const segments = toPath(path);

  const api: StoreApi<V> = {
    getInitialState: () => getPath(store.getInitialState(), segments) as V,
    getState: () => getPath(store.getState(), segments) as V,
    setState: (partial) => {
      store.setState((state) => {
        const current = getPath(state, segments) as V;
        const newState = (
          typeof partial === 'function'
            ? (partial as AnyFunction)(current)
            : partial
        ) as V;
        return setIn(state, segments, { ...current, ...newState });
      });
    },
    subscribe: (listener) =>
      store.subscribe((state, prevState) => {
        const scopedState = getPath(state, segments) as V;
        const scopedPrevState = getPath(prevState, segments) as V;
        if (!Object.is(scopedState, scopedPrevState)) {
          listener(scopedState, scopedPrevState);
        }
      }),
  };
  return forwardUntracked(store, api);
}

/**
 * Gets a scoped API for accessing a specific form within a larger store state.
 * Useful when you have multiple forms or nested form structures in your store.
 *
 * @param store - The Zustand store instance
 * @param formPath - The path to the specific form within the store
 * @returns A scoped store API for the specified form
 */
export function getFormApi<
  S extends object,
  const K extends DeepKeys<S>,
  V = K extends DeepKeys<S> ? DeepValue<S, K> : S,
>(store: StoreApi<S>, formPath: K): StoreApi<V> {
  return getScopedApi(store, formPath) as StoreApi<V>;
}

const BASE_KEYS = [
  'values',
  'initialValues',
  'errors',
  'touched',
  'dirty',
] as const;

function getScopedBaseState<V>(
  state: BaseFormState<any>,
  segments: readonly string[]
): BaseFormState<V> {
  return {
    values: getPath(state.values, segments) as V,
    initialValues: getPath(state.initialValues, segments) as V | undefined,
    errors: getPath(state.errors, segments) as BaseFormState<V>['errors'],
    dirty: getPath(state.dirty, segments) as BaseFormState<V>['dirty'],
    touched: getPath(state.touched, segments) as BaseFormState<V>['touched'],
  };
}

/** The form data and flags at `path`, as a plain object. */
export function getScopedFormState<
  S,
  const K extends DeepKeys<S>,
  V = DeepValue<S, K>,
>(state: BaseFormState<S>, path: K): BaseFormState<V> & FormComputed {
  const base = getScopedBaseState<V>(state, toPath(path));
  return { ...base, ...computeFlags(base) };
}

/**
 * A `StoreApi` for the form at `path` inside a form store. Reads map the
 * slices to the path, writes go back immutably, actions and flags apply to the
 * scope only. This is what `FormController` and `useFormController` use.
 */
export function getScopedFormApi<
  S,
  const K extends DeepKeys<S>,
  V = DeepValue<S, K>,
>(store: StoreApi<FormState<S>>, path: K): StoreApi<FormState<V>> {
  const segments = toPath(path);

  // Scoped state is derived, so it is cached per root state and shares identity
  // across root states whenever none of the five base slices changed. That
  // identity is what subscribers and React compare against.
  const cache = new WeakMap<object, FormState<V>>();
  let last: FormState<V> | undefined;
  const scopedFrom = (root: FormState<S>): FormState<V> => {
    const cached = cache.get(root);
    if (cached) return cached;
    const base = getScopedBaseState<V>(root, segments);
    const unchanged =
      last !== undefined &&
      last.isSubmitting === root.isSubmitting &&
      BASE_KEYS.every((key) => Object.is(base[key], last![key]));
    const scoped = unchanged
      ? last!
      : ({
          ...base,
          ...computeFlags(base),
          isSubmitting: root.isSubmitting,
          ...actions,
        } as FormState<V>);
    cache.set(root, scoped);
    last = scoped;
    return scoped;
  };

  const getState = () => scopedFrom(store.getState());

  const getInitialState = () => ({
    ...getScopedFormState<S, K, V>(store.getInitialState(), path),
    isSubmitting: store.getInitialState().isSubmitting,
    ...actions,
  });

  const setState: StoreApi<FormState<V>>['setState'] = (partial) => {
    store.setState((root) => {
      const scoped = scopedFrom(root);
      const partialState = (
        typeof partial === 'function'
          ? (partial as AnyFunction)(scoped)
          : partial
      ) as Partial<BaseFormState<V>>;

      let next: any = root;
      for (const key of ['values', 'initialValues', 'errors'] as const) {
        if (!(key in partialState)) continue;
        const value = partialState[key];
        // Writing undefined where nothing exists is a no-op, so a blur does
        // not create an empty container and make `state.dirty` truthy.
        if (value === undefined && getPath(next[key], segments) === undefined) {
          continue;
        }
        next = setIn(next, [key, ...segments], value);
      }
      for (const key of ['touched', 'dirty'] as const) {
        if (!(key in partialState)) continue;
        const value = partialState[key];
        if (value !== undefined) {
          next = setIn(next, [key, ...segments], value);
        } else if (getPath(next[key], segments) !== undefined) {
          // Clearing a subtree also prunes ancestor flags that no longer have
          // flagged descendants, so a scoped reset does not leave its parents
          // marked.
          const flag = key === 'touched' ? '_touched' : '_dirty';
          next = { ...next, [key]: pruneFlags(next[key], segments, flag) };
        }
      }
      return next === root ? {} : next;
    });
  };

  const subscribe: StoreApi<FormState<V>>['subscribe'] = (listener) =>
    store.subscribe((state, prevState) => {
      const notify = () => {
        const scopedState = scopedFrom(state);
        const scopedPrevState = scopedFrom(prevState);
        if (scopedState !== scopedPrevState) {
          listener(scopedState, scopedPrevState);
        }
      };
      if (state.isSubmitting !== prevState.isSubmitting) return notify();
      // Fast path: nothing in this scope changed. Checked per base slice so
      // untouched fields cost a few property reads per update and nothing else.
      for (const key of BASE_KEYS) {
        if (
          state[key] !== prevState[key] &&
          !Object.is(
            getPath(state[key], segments),
            getPath(prevState[key], segments)
          )
        ) {
          return notify();
        }
      }
    });

  const actions: FormActions<V> = {
    reset: (values, options) =>
      runUntracked(store, () => {
        const partial: Partial<BaseFormState<V>> = {
          errors: undefined,
          touched: undefined,
          dirty: undefined,
        };
        if (values === undefined) {
          partial.values = getState().initialValues ?? getInitialState().values;
        } else {
          partial.values = values;
          if (!options?.keepInitialValues) partial.initialValues = values;
        }
        setState(partial as Partial<FormState<V>>);
      }),
    resetTouched: () =>
      setState({ touched: undefined } as Partial<FormState<V>>),
    resetDirty: () => setState({ dirty: undefined } as Partial<FormState<V>>),
    resetErrors: () => setState({ errors: undefined } as Partial<FormState<V>>),
    setErrors: (errors) =>
      store.setState(
        (root) =>
          ({
            errors: setErrorNode(root.errors, segments, errors),
          }) as Partial<FormState<S>>
      ),
    setError: (...args: unknown[]) => {
      const [path, message] = parseSetErrorArgs(args);
      store.setState(
        (root) =>
          ({
            errors: setErrorMessages(
              root.errors,
              [...segments, ...toPath(path as any)],
              message
            ),
          }) as Partial<FormState<S>>
      );
    },
    touchAll: () =>
      store.setState((root) => {
        const values = getPath(root.values, segments);
        const marked = markPath(root.touched, segments, '_touched');
        const touched = setIn(marked, segments, buildTouched(values));
        return { touched } as unknown as Partial<FormState<S>>;
      }),
    validate: () => {
      const parent = store.getState() as Partial<FormActions<S>>;
      parent.validate?.();
      return !hasErrors(getPath(store.getState().errors, segments));
    },
    handleSubmit: (onValid, onInvalid) =>
      createSubmitHandler(
        {
          touchAll: () => actions.touchAll(),
          validate: () => actions.validate(),
          getState,
          setSubmitting: (isSubmitting) =>
            store.setState({ isSubmitting } as Partial<FormState<S>>),
        },
        onValid,
        onInvalid
      ),
  };

  return forwardUntracked(store, {
    getInitialState,
    getState,
    setState,
    subscribe,
  } as StoreApi<FormState<V>>);
}
