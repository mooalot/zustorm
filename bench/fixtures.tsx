/**
 * Shared fixtures for the zustorm vs react-hook-form benchmarks.
 *
 * Both libraries render the same shape: a form with `n` string fields named
 * `f0..f{n-1}`, optionally validated by a Zod schema requiring every field to
 * be non-empty, optionally with a header component that subscribes to form
 * validity and dirtiness (the "disabled submit button" pattern).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useFormState, Control } from 'react-hook-form';
import { z } from 'zod';
import { createStore, StoreApi, useStore } from 'zustand';
import { FormController, FormState, withForm } from '../src';

export type Values = Record<string, string>;

export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function makeValues(n: number): Values {
  const values: Values = {};
  for (const i of range(n)) values[`f${i}`] = `value ${i}`;
  return values;
}

export function makeSchema(n: number) {
  const shape: Record<string, z.ZodString> = {};
  for (const i of range(n)) shape[`f${i}`] = z.string().min(1, 'Required');
  return z.object(shape);
}

/** Render counters, keyed by component label. */
export const renders: Record<string, number> = {};
export function countRender(label: string) {
  renders[label] = (renders[label] ?? 0) + 1;
}
export function resetRenders() {
  for (const key of Object.keys(renders)) delete renders[key];
}

// ---------------------------------------------------------------------------
// zustorm
// ---------------------------------------------------------------------------

export function createZustormStore(n: number, validate: boolean) {
  const schema = validate ? makeSchema(n) : undefined;
  return createStore(
    withForm(makeValues(n), { getSchema: schema ? () => schema : undefined })
  );
}

function ZustormHeader({ store }: { store: StoreApi<FormState<Values>> }) {
  countRender('zustorm-header');
  const isValid = useStore(store, (state) => state.isValid);
  const isDirty = useStore(store, (state) => state.isDirty);
  return (
    <button type="submit" disabled={!isValid || !isDirty}>
      Save
    </button>
  );
}

function ZustormField({
  store,
  index,
}: {
  store: StoreApi<FormState<Values>>;
  index: number;
}) {
  countRender(`zustorm-field-${index}`);
  return (
    <FormController
      store={store}
      name={`f${index}`}
      render={({ value, onChange, onBlur, errorMessage, isTouched }) => {
        countRender(`zustorm-render-${index}`);
        return (
          <>
            <input
              data-testid={`z-${index}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
            />
            {isTouched && errorMessage ? <span>{errorMessage}</span> : null}
          </>
        );
      }}
    />
  );
}

export function ZustormForm({
  store,
  n,
  header,
  onSubmit,
}: {
  store: StoreApi<FormState<Values>>;
  n: number;
  header?: boolean;
  onSubmit?: (values: Values) => void;
}) {
  const handleSubmit = useStore(store, (state) => state.handleSubmit);
  return (
    <form
      data-testid="z-form"
      onSubmit={onSubmit ? handleSubmit(onSubmit) : undefined}
    >
      {header ? <ZustormHeader store={store} /> : null}
      {range(n).map((i) => (
        <ZustormField key={i} store={store} index={i} />
      ))}
    </form>
  );
}

// ---------------------------------------------------------------------------
// react-hook-form
// ---------------------------------------------------------------------------

function RhfHeader({ control }: { control: Control<Values> }) {
  countRender('rhf-header');
  const { isValid, isDirty } = useFormState({ control });
  return (
    <button type="submit" disabled={!isValid || !isDirty}>
      Save
    </button>
  );
}

function RhfControlledField({
  control,
  index,
}: {
  control: Control<Values>;
  index: number;
}) {
  countRender(`rhf-field-${index}`);
  return (
    <Controller
      control={control}
      name={`f${index}`}
      render={({ field, fieldState }) => {
        countRender(`rhf-render-${index}`);
        return (
          <>
            <input data-testid={`r-${index}`} {...field} />
            {fieldState.isTouched && fieldState.error?.message ? (
              <span>{fieldState.error.message}</span>
            ) : null}
          </>
        );
      }}
    />
  );
}

export function RhfForm({
  n,
  validate,
  header,
  controlled,
  onSubmit,
}: {
  n: number;
  validate: boolean;
  header?: boolean;
  /** Use <Controller> (re-renders per field like zustorm) instead of register(). */
  controlled?: boolean;
  onSubmit?: (values: Values) => void;
}) {
  countRender('rhf-form');
  const methods = useForm<Values>({
    defaultValues: makeValues(n),
    resolver: validate ? zodResolver(makeSchema(n)) : undefined,
    mode: validate ? 'onChange' : 'onSubmit',
  });
  return (
    <form
      data-testid="r-form"
      onSubmit={methods.handleSubmit((values) => onSubmit?.(values))}
    >
      {header ? <RhfHeader control={methods.control} /> : null}
      {range(n).map((i) =>
        controlled ? (
          <RhfControlledField key={i} control={methods.control} index={i} />
        ) : (
          <input
            key={i}
            data-testid={`r-${i}`}
            {...methods.register(`f${i}`)}
          />
        )
      )}
    </form>
  );
}
