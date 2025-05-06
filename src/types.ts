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

export type WithForm<T> = {
  values: T;
  errors?: ZodFormattedError<T>;
  touched?: Touches<T>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  schema?: ZodType<T>;
};

type Touch<T> = {
  _touched: boolean;
} & Touches<T>;

export type Touches<T> = {
  [K in keyof T]?: Touch<T[K]>;
};
