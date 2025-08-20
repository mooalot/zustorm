import { StoreApi } from 'zustand';

export type AnyFunction = (...args: any[]) => any;

// Dot-notation string paths
export type DeepKeyStrings<T> = T extends AnyFunction
  ? never
  : T extends Array<infer U>
  ? `${number}` | `${number}.${DeepKeyStrings<U>}`
  : T extends object
  ? {
      [K in keyof T & (string | number)]: T[K] extends object
        ? `${K}` | `${K}.${DeepKeyStrings<T[K]>}`
        : `${K}`;
    }[keyof T & (string | number)]
  : never;

// Array-based key paths
export type DeepKeyTuples<T> = T extends AnyFunction
  ? never
  : T extends Array<infer U>
  ? [number] | [number, ...DeepKeyTuples<U>]
  : T extends object
  ? {
      [K in keyof T & (string | number)]: T[K] extends object
        ? [K] | [K, ...DeepKeyTuples<T[K]>]
        : [K];
    }[keyof T & (string | number)]
  : never;

// Combined
export type DeepKeys<T> = DeepKeyStrings<T> | DeepKeyTuples<T>;

export type DeepValue<
  T,
  P extends string | readonly (string | number)[]
> = P extends string
  ? DeepValueFromStringPath<T, P>
  : P extends readonly [infer K, ...infer Rest]
  ? K extends keyof T
    ? Rest extends []
      ? T[K]
      : DeepValue<T[K], Extract<Rest, (string | number)[]>>
    : T extends Array<infer U>
    ? K extends number
      ? DeepValue<U, Extract<Rest, (string | number)[]>>
      : never
    : never
  : T;

type DeepValueFromStringPath<
  T,
  P extends string
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? DeepValue<T[K], Rest>
    : T extends Array<infer U>
    ? K extends `${number}`
      ? DeepValue<U, Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : T extends Array<infer U>
  ? P extends `${number}`
    ? U
    : never
  : never;

/**
 * The core form state type that represents the complete state of a form.
 * Includes form values, validation errors, touched/dirty states, and submission status.
 */
export type FormState<T> = {
  /**
   * The current values of the form fields.
   */
  values: T;
  /**
   * The errors of the form fields. Currently only supports Zod errors.
   */
  errors?: Nested<
    T,
    {
      _errors?: string[];
    }
  >;
  /**
   * The touched state of the form fields.
   */
  touched?: Nested<
    T,
    {
      _touched?: boolean;
    }
  >;
  /**
   * If the form is dirty. This is a boolean value that indicates if the form is dirty or not.
   */
  dirty?: Nested<
    T,
    {
      _dirty?: boolean;
    }
  >;
};

export type Nested<T, O> = O &
  Partial<{
    [K in keyof T]: T[K] extends Array<infer U>
      ? { [key: string]: Nested<U, O> }
      : T[K] extends object
      ? Nested<T[K], O>
      : O;
  }>;

export type FormControllerRenderProps<
  Value,
  FormState = unknown,
  Context = unknown
> = {
  /**
   * onFormChange is a function that can be used to update the form state.
   * It can be a value or a function that returns a value.
   */
  onFormChange: (form: FormState | ((form: FormState) => FormState)) => void;
  /**
   * The context object for the field. Evaluated from the contextSelector.
   */
  context: Context;
  /**
   * The value of the field.
   */
  value: Value;
  /**
   * The function to call when the value changes.
   * It can be a value or a function that returns a value.
   */
  onChange: (value: Value | ((value: Value) => Value)) => void;
  /**
   * The function to call when the input is blurred.
   * It can be used to trigger validation or other side effects.
   */
  onBlur?: () => void;
  /**
   * The error object for the field.
   */
  error?: Nested<
    Value,
    {
      _errors?: string[];
    }
  >;
  /**
   * The touched state of the field.
   */
  touched?: Nested<
    Value,
    {
      _touched?: boolean;
    }
  >;
  /**
   * If the field is dirty.
   */
  dirty?: Nested<
    Value,
    {
      _dirty?: boolean;
    }
  >;
};

export type FormControllerProps<
  S,
  C,
  K extends DeepKeys<S> | undefined = undefined
> = {
  store: StoreApi<FormState<S>>;
  name?: K;
  contextSelector?: (state: S) => C;
  render: (
    props: FormControllerRenderProps<
      K extends DeepKeys<S> ? DeepValue<S, K> : S,
      S,
      C
    >
  ) => JSX.Element;
  options?: {
    useStore?: <S, R>(
      storeApi: StoreApi<FormState<S>>,
      callback: (selector: FormState<S>) => R
    ) => R;
  };
};
