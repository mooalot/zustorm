import { useCallback, useMemo } from 'react';
import { StoreApi, useStore as useStoreZustand } from 'zustand';
import {
  AnyFunction,
  DeepKeys,
  DeepValue,
  FormControllerRenderProps,
  FormState,
  UseFormControllerOptions,
} from './types';
import { getErrorMessages } from './errors';
import { computeFlags } from './form';
import { getScopedFormApi } from './scoped';

/** Resolves a value-or-updater argument against the current value. */
function resolve<T>(next: T | ((current: T) => T), current: T): T {
  return typeof next === 'function' ? (next as AnyFunction)(current) : next;
}

/**
 * Stands in for the root store when no `contextSelector` is given, so fields
 * without context do not subscribe to every root update.
 */
const NOOP_STORE = {
  getState: () => undefined,
  getInitialState: () => undefined,
  setState: () => {},
  subscribe: () => () => {},
} as unknown as StoreApi<FormState<any>>;

/**
 * Hook form of `FormController`. Subscribes to a form (or a field within it)
 * and returns the same value, handlers, flags and actions the render prop
 * receives.
 *
 * @param store - The form store instance
 * @param name - Optional path to a specific field within the form
 * @param options - Optional configuration object
 * @param options.contextSelector - Function to select additional context from the form values
 * @param options.useStore - Custom store hook to use instead of the default zustand useStore
 */
export function useFormController<
  S,
  C = undefined,
  const K extends DeepKeys<S> | undefined = undefined,
>(
  store: StoreApi<FormState<S>>,
  name?: K,
  options?: UseFormControllerOptions<S, C>
): FormControllerRenderProps<
  K extends DeepKeys<S> ? DeepValue<S, K> : S,
  S,
  C
> {
  type V = K extends DeepKeys<S> ? DeepValue<S, K> : S;
  const { contextSelector, useStore = useStoreZustand } = options || {};

  const scopedStore = useMemo(
    () =>
      (name ? getScopedFormApi(store, name as DeepKeys<S>) : store) as StoreApi<
        FormState<V>
      >,
    [store, name]
  );

  // A scoped store's state keeps its identity until one of its slices changes,
  // so a single subscription to the whole scoped state is enough. Without a
  // name the scope is the whole form, which re-renders on any change anyway.
  const scoped = useStore(scopedStore, (state) => state);
  const { values: value, errors: error, touched, dirty } = scoped;
  const context = useStore(contextSelector ? store : NOOP_STORE, (state) =>
    contextSelector ? contextSelector(state.values) : undefined
  ) as C;

  const flags = useMemo(
    () =>
      name
        ? {
            isDirty: scoped.isDirty,
            isTouched: scoped.isTouched,
            isValid: scoped.isValid,
          }
        : computeFlags({ values: value, errors: error, touched, dirty }),
    // `value` has no bearing on the flags.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, scoped, error, touched, dirty]
  );
  const errorMessages = useMemo(() => getErrorMessages(error), [error]);

  const reset = useCallback<FormControllerRenderProps<V>['reset']>(
    (values, resetOptions) =>
      scopedStore.getState().reset(values, resetOptions),
    [scopedStore]
  );
  const resetTouched = useCallback(
    () => scopedStore.getState().resetTouched(),
    [scopedStore]
  );
  const resetDirty = useCallback(
    () => scopedStore.getState().resetDirty(),
    [scopedStore]
  );
  const resetErrors = useCallback(
    () => scopedStore.getState().resetErrors(),
    [scopedStore]
  );
  const setErrors = useCallback<FormControllerRenderProps<V>['setErrors']>(
    (errors) => scopedStore.getState().setErrors(errors),
    [scopedStore]
  );
  const setError = useCallback(
    (...args: unknown[]) =>
      (scopedStore.getState().setError as (...a: unknown[]) => void)(...args),
    [scopedStore]
  ) as FormControllerRenderProps<V>['setError'];
  const touchAll = useCallback(
    () => scopedStore.getState().touchAll(),
    [scopedStore]
  );
  const validate = useCallback(
    () => scopedStore.getState().validate(),
    [scopedStore]
  );
  const handleSubmit = useCallback<
    FormControllerRenderProps<V>['handleSubmit']
  >(
    (onValid, onInvalid) =>
      scopedStore.getState().handleSubmit(onValid, onInvalid),
    [scopedStore]
  );

  const onBlur = useCallback(() => {
    scopedStore.setState(
      (state) =>
        ({
          touched: { ...(state.touched ?? {}), _touched: true },
        }) as Partial<FormState<V>>
    );
  }, [scopedStore]);

  const onFormChange = useCallback<
    FormControllerRenderProps<V, S>['onFormChange']
  >(
    (form) => {
      store.setState(
        (state) =>
          ({ values: resolve(form, state.values) }) as Partial<FormState<S>>
      );
    },
    [store]
  );

  const onChange = useCallback<FormControllerRenderProps<V>['onChange']>(
    (newValue) => {
      if (typeof newValue === 'function') {
        scopedStore.setState(
          (state) =>
            ({ values: resolve(newValue, state.values) }) as Partial<
              FormState<V>
            >
        );
      } else {
        scopedStore.setState({ values: newValue } as Partial<FormState<V>>);
      }
    },
    [scopedStore]
  );

  return {
    value,
    error,
    errorMessage: errorMessages[0],
    errorMessages,
    touched,
    dirty,
    context,
    ...flags,
    isSubmitting: scoped.isSubmitting,
    reset,
    resetTouched,
    resetDirty,
    resetErrors,
    setErrors,
    setError,
    touchAll,
    validate,
    handleSubmit,
    onBlur,
    onFormChange,
    onChange,
  };
}
