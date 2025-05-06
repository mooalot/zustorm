import { ZodFormattedError, ZodType } from 'zod';

// Dot-notation string paths
export type DeepKeyStrings<T> = T extends Function
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
export type DeepKeyTuples<T> = T extends Function
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

export type FormState<T> = {
  /**
   * The current values of the form fields.
   */
  values: T;
  /**
   * The errors of the form fields. Currently only supports Zod errors.
   */
  errors?: ZodFormattedError<T>;
  /**
   * The touched state of the form fields.
   */
  isTouched: boolean;
  /**
   * If the form is valid. This is a boolean value that indicates if the form is valid or not.
   */
  isValid: boolean;
  /**
   * If the form is submitting. This is a boolean value that indicates if the form is currently submitting or not.
   * This value is here to be used when needed. You'll have to set it manually.
   */
  isSubmitting: boolean;
  /**
   * If the form is dirty. This is a boolean value that indicates if the form is dirty or not.
   */
  isDirty: boolean;
};

// type Touch<T> = {
//   _touched: boolean;
// } & Touches<T>;

// export type Touches<T> = {
//   [K in keyof T]?: Touch<T[K]>;
// };
