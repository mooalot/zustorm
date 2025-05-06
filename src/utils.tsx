import { produce, WritableDraft } from 'immer';
import { get, set } from 'lodash-es';
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { z, ZodFormattedError } from 'zod';
import {
  createStore,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
  useStore as useStore2,
} from 'zustand';
import { shallow } from 'zustand/shallow';
import { DeepKeys, DeepValue, WithForm } from './types';

type Write<T, U> = Omit<T, keyof U> & U;
type WithComputed<S, A> = S extends { getState: () => infer T }
  ? Write<S, Compute<T, A>>
  : never;

declare module 'zustand/vanilla' {
  interface StoreMutators<S, A> {
    'forms/computer': WithComputed<S, A>;
  }
}

/**Middleware */

type Computed = <T extends object, K extends keyof T>(
  computed: Compute<T, Pick<T, K>>,
  options?: Options<T>
) => <
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  creator: StateCreator<T, [...Mps, ['forms/computer', unknown]], Mcs>
) => StateCreator<T, Mps, [['forms/computer', Pick<T, K>], ...Mcs]>;

export type Compute<T, A> = (state: T) => A;

export type Options<T> = {
  /**
   * An array of keys that the computed function depends on. If any of these keys changed, the computed function will be re-run.
   */
  keys?: (keyof T)[];
  /**
   * Disable the Proxy object that tracks which selectors are accessed. This is useful if you want to disable the Proxy object for nested changes.
   */
  disableProxy?: boolean;
  /**
   * A custom equality function to determine if the computed state has changed. By default, a shallow equality check is used.
   */
  equalityFn?: (a: any, b: any) => boolean;
};

export function produceStore<T>(
  useStore: { setState: StoreApi<T>['setState'] },
  producer: (draft: WritableDraft<T>) => void
) {
  useStore.setState((state) => produce(state, producer));
}

/**
 * A middleware that creates a computed state object.
 */
export const createComputer =
  createComputerImplementation as unknown as Computed;
function createComputerImplementation<T extends object, K extends keyof T>(
  compute: Compute<T, Pick<T, K>>,
  opts: Options<T> = {}
): (creator: StateCreator<T>) => StateCreator<T> {
  return (creator) => {
    return (set, get, api) => {
      const trackedSelectors = new Set<string | number | symbol>();

      const equalityFn = opts?.equalityFn ?? shallow;

      if (opts?.keys) {
        const selectorKeys = opts.keys;
        for (const key of selectorKeys) {
          trackedSelectors.add(key);
        }
      }

      const useSelectors = opts?.disableProxy !== true || !!opts?.keys;
      const useProxy = opts?.disableProxy !== true && !opts?.keys;

      const computeAndMerge = (state: T): T => {
        const stateProxy = new Proxy(
          { ...state },
          {
            get: (_, prop) => {
              trackedSelectors.add(prop);
              return state[prop as keyof T];
            },
          }
        );

        // calculate the new computed state
        const computedState = compute(useProxy ? stateProxy : { ...state });
        const newState = { ...computedState };

        for (const key in newState) {
          if (equalityFn(newState[key], state[key])) {
            newState[key] = state[key];
          }
        }
        return { ...state, ...newState };
      };

      type SetState = StoreApi<T>['setState'];
      const setWithComputed = (set: SetState): SetState => {
        return (state) => {
          const prevState = get();
          const nextPartialState =
            typeof state === 'function' ? state(prevState) : state;
          const newState = { ...prevState, ...nextPartialState };

          const changedKeys: string[] = [];
          for (const key in newState) {
            if (prevState[key] !== newState[key]) {
              changedKeys.push(key);
            }
          }
          if (
            useSelectors &&
            trackedSelectors.size !== 0 &&
            !changedKeys.some((k) => trackedSelectors.has(k))
          ) {
            set(newState);
          } else {
            set(computeAndMerge(newState));
          }
        };
      };

      api.setState = setWithComputed(api.setState);

      return computeAndMerge(creator(setWithComputed(set), get, api));
    };
  };
}

function safeGet(obj: any, path: any, defaultValue?: any) {
  if (!path || (Array.isArray(path) && path.length === 0)) {
    return obj;
  }
  return get(obj, path, defaultValue);
}

function safeSet(obj: any, path: any, value: any) {
  if (!path || (Array.isArray(path) && path.length === 0)) {
    return obj;
  }
  return set(obj, path, value);
}

export type FormRenderProps<T, A, F> = {
  value: T;
  onChange: (value: T | ((value: T) => T), form?: F | ((form: F) => F)) => void;
  error?: ZodFormattedError<T>;
  context: A;
};

export type FormController<T> = {
  <K extends DeepKeys<T> | undefined = undefined, C = undefined>(props: {
    name?: K;
    contextSelector?: (state: T) => C;
    render: (
      props: FormRenderProps<
        K extends DeepKeys<T> ? DeepValue<T, K> : T,
        C extends undefined ? undefined : C,
        T
      >
    ) => React.ReactNode;
  }): React.ReactNode;
};

export function createFormController<
  S,
  K extends DeepKeys<S> | undefined = undefined,
  V = K extends DeepKeys<S> ? DeepValue<S, K> : S,
  U = V extends WithForm<infer X> ? X : never,
  EN extends DeepKeys<U> | undefined = undefined
>(
  /**
   * Store can be either store api or a bound store.
   * If its a bound store, it will use that as its default selector.
   * If its a store api, it will default to zustand's default selector.
   * Either of these options can be overriden when passing useStore into options.
   */
  store: StoreApi<S> | (StoreApi<S> & (<U>(selector: (state: S) => U) => U)),
  options?: {
    /**
     * The path to the form in the store. Note: this will override whatever formpath in the store provider if used.
     */
    formPath?: K;
    /**
     * The name (path) of the variable to edit. Note, this builds on top of the path in the store provider if used.
     */
    name?: EN;
    /**
     * The function to use the store
     */
    useStore?: (storeApi: StoreApi<S>, callback: (selector: S) => any) => any;
  }
): FormController<EN extends DeepKeys<U> ? DeepValue<U, EN> : U> {
  const {
    formPath: initialFormPath = '',
    name: initialName = '',
    useStore: useMethod = useStore2,
  } = options || {};

  return (props) => {
    const useStore = useCallback(
      <T,>(callback: (selector: S) => T) => {
        if (typeof store === 'function' && !options?.useStore) {
          return store(callback);
        } else {
          return useMethod(store, callback);
        }
      },
      [store, useMethod]
    );
    const { name: contextName = '', formPath: contextFormPath = '' } =
      useContext(PathContext) as PathContext<S, K>;
    const formPath = initialFormPath || contextFormPath;
    const { name = '', render, contextSelector } = props;
    type Value = Parameters<typeof render>[0]['value'];

    function getResolvePath(state: any, ...segments: any[]) {
      return [...segments]
        .filter(Boolean)
        .reduce((obj, segment) => safeGet(obj, segment), state);
    }

    function setResolvePath(
      state: any,
      value: any,
      ...segments: any[]
    ): WithForm<U> {
      const filteredSegments = segments.filter(Boolean);
      const lastSegment = filteredSegments.pop();
      const target = filteredSegments.reduce((obj, segment) => {
        const current = safeGet(obj, segment);
        if (current === undefined) {
          return safeSet(obj, segment, {});
        }
        return current;
      }, state);
      if (lastSegment) {
        safeSet(target, lastSegment, value);
      }
      return state;
    }

    function getForm(state: S): WithForm<U> {
      return formPath
        ? (safeGet(state, formPath) as WithForm<U>)
        : (state as unknown as WithForm<U>);
    }

    const value = useStore((state) => {
      return getResolvePath(
        state,
        formPath,
        'values',
        contextName,
        initialName,
        name
      ) as Value;
    });
    const error = useStore((state) => {
      return getResolvePath(
        state,
        formPath,
        'errors',
        contextName,
        initialName,
        name
      ) as ZodFormattedError<Value>;
    });
    const context = useStore((state) => {
      if (!contextSelector) return undefined;
      const values = getResolvePath(state, formPath, 'values', contextName);
      if (!values) return undefined;
      return contextSelector(values);
    });

    return render({
      value,
      onChange: useCallback(
        (value, form) => {
          produceStore(store, (state) => {
            const formState = getForm(state as S);
            if (!formState.values) return;

            const newValue =
              typeof value === 'function'
                ? (value as Function)(
                    getResolvePath(
                      state,
                      'values',
                      contextName,
                      initialName,
                      name
                    )
                  )
                : value;

            setResolvePath(
              formState,
              newValue,
              'values',
              contextName,
              initialName,
              name
            );

            if (form) {
              const newValues =
                typeof form === 'function'
                  ? (form as Function)(formState.values)
                  : form;
              formState.values = newValues;
            }
          });
        },
        [store]
      ),
      error,
      context: context as any,
    });
  };
}

export function createFormComputer<S extends object>() {
  return function <
    K extends DeepKeys<S> | undefined,
    F extends K extends DeepKeys<S>
      ? DeepValue<S, K>
      : S = K extends DeepKeys<S> ? DeepValue<S, K> : S
  >({
    getSchema,
    formPath,
  }: {
    getSchema: (
      state: S
    ) => z.ZodType<F extends WithForm<infer F> ? F : never> | undefined;
    formPath?: K;
  }) {
    return createComputer<S, keyof S>((state) => {
      const schema = getSchema?.(state);

      return produce(state, (draft) => {
        const form = safeGet(draft, formPath ?? '') as WithForm<F>;

        if (!form) return; // Avoid modifying undefined

        const errors = (schema ?? z.object({})).safeParse(form.values);
        const errorsFormatted = errors.error?.format();

        set(draft, formPath ?? [], {
          ...form,
          isValid: errors.success,
          errors: errorsFormatted,
        });
      });
    });
  };
}

export type FormStore<T> = WithForm<T>;

export function getDefaultForm<T extends object>(value: T): WithForm<T> {
  return {
    isValid: true,
    isDirty: false,
    isSubmitting: false,
    values: value,
  };
}

export const createFormStore = <T extends object>(
  props: T,
  schema?: z.ZodType<T>
) => {
  const formComputer = createFormComputer<FormStore<T>>()({
    getSchema: (state) => state.schema as any,
  });

  return createStore<FormStore<T>>()(
    formComputer(() => ({
      ...getDefaultForm(props),
      schema,
    }))
  );
};

const FormStoreContext = createContext<StoreApi<any> | undefined>(undefined);

type PathContext<S, K> = {
  formPath?: S;
  name?: K;
};

const PathContext = createContext<PathContext<any, any>>({});

// there should either be more options on a form provider or a new componnt that allows you to change the context of the children,
//similar to how creating a form controller works, such as providing an initial name
export const FormStoreProvider = <
  T,
  K extends DeepKeys<T> | undefined = undefined,
  V = K extends DeepKeys<T> ? DeepValue<T, K> : T,
  U = V extends WithForm<infer X> ? X : never,
  EN extends DeepKeys<U> | undefined = undefined
>({
  children,
  store,
  options,
}: {
  children: React.ReactNode;
  store: StoreApi<T>;
  options?: {
    /**
     * Provide the path to the form in the store
     */
    formPath?: K;
    /**
     * Provide the name (path) to the variable in the form
     */
    name?: EN;
  };
}) => {
  const { name: initialName, formPath } = options || {};
  const pathContext = useMemo(
    () => ({
      formPath: formPath ?? '',
      name: initialName ?? '',
    }),
    [formPath, initialName]
  );
  return (
    <PathContext.Provider value={pathContext}>
      <FormStoreContext.Provider value={store}>
        {children}
      </FormStoreContext.Provider>
    </PathContext.Provider>
  );
};

export function useFormStoreApi<S>() {
  const store = useContext(FormStoreContext) as StoreApi<FormStore<S>>;
  if (!store) {
    throw new Error(
      'useFieldStoreContext must be used within FieldStoreProvider'
    );
  }
  return store;
}
