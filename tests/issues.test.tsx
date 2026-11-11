/**
 * Regressions for reported GitHub issues.
 */
import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { create, createStore } from 'zustand';
import {
  FormState,
  getFormApi,
  getScopedFormApi,
  useFormController,
  withForm,
} from '../src';

describe('#7 scoped getInitialState is cached', () => {
  it('returns the same snapshot until the parent initial state changes', () => {
    const store = createStore(withForm({ name: '', age: 1 }));
    const scoped = getScopedFormApi(store, 'name');
    const first = scoped.getInitialState();
    expect(scoped.getInitialState()).toBe(first);
    expect(first.values).toBe('');
    expect(typeof first.setError).toBe('function');
  });

  it('server rendering and hydrating a scoped controller does not warn', () => {
    const store = createStore(withForm({ name: 'Ada' }));
    function Field() {
      const f = useFormController(store, 'name');
      return <input value={f.value} onChange={() => {}} />;
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const html = renderToString(<Field />);
      expect(html).toContain('Ada');
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      let root: ReturnType<typeof hydrateRoot> | undefined;
      act(() => {
        root = hydrateRoot(container, <Field />);
      });
      act(() => root!.unmount());
      container.remove();
      const messages = error.mock.calls.map((c) => String(c[0]));
      expect(messages.filter((m) => m.includes('getServerSnapshot'))).toEqual(
        []
      );
    } finally {
      error.mockRestore();
    }
  });
});

describe('#8 manually set errors hold until their own field changes', () => {
  type Values = { name: string; email: string; agree: boolean };
  const schema = z.object({
    name: z.string().min(1, 'Name required'),
    email: z.string(),
    agree: z.boolean(),
  });
  const make = () =>
    createStore(
      withForm<Values>(
        { name: 'Ada', email: 'ada@example.com', agree: false },
        { getSchema: () => schema }
      )
    );

  it('editing another field keeps a setError message', () => {
    const store = make();
    store.getState().setError('email', 'Already registered');
    store.setState((s) => ({ values: { ...s.values, agree: true } }));
    expect(store.getState().errors?.email?._errors).toEqual([
      'Already registered',
    ]);
    expect(store.getState().isValid).toBe(false);
  });

  it('keeps it alongside schema errors on other fields', () => {
    const store = make();
    store.getState().setError('email', 'Already registered');
    store.setState((s) => ({ values: { ...s.values, name: '' } }));
    expect(store.getState().errors?.name?._errors).toEqual(['Name required']);
    expect(store.getState().errors?.email?._errors).toEqual([
      'Already registered',
    ]);
  });

  it('editing the field itself drops it', () => {
    const store = make();
    store.getState().setError('email', 'Already registered');
    store.setState((s) => ({ values: { ...s.values, email: 'b@x.io' } }));
    expect(store.getState().errors).toBeUndefined();
    // and it does not come back on a later unrelated edit
    store.setState((s) => ({ values: { ...s.values, agree: true } }));
    expect(store.getState().errors).toBeUndefined();
  });

  it('setErrors from a server response holds per field', () => {
    const store = make();
    store.getState().setErrors({
      _errors: [],
      name: { _errors: ['Name taken'] },
      email: { _errors: ['Email taken'] },
    });
    store.setState((s) => ({ values: { ...s.values, name: 'Grace' } }));
    expect(store.getState().errors?.name).toBeUndefined();
    expect(store.getState().errors?.email?._errors).toEqual(['Email taken']);
  });

  it('resetErrors, validate, reset and setErrors(undefined) clear them for good', () => {
    for (const clear of [
      (s: FormState<Values>) => s.resetErrors(),
      (s: FormState<Values>) => s.validate(),
      (s: FormState<Values>) => s.reset(),
      (s: FormState<Values>) => s.setErrors(undefined),
    ]) {
      const store = make();
      store.getState().setError('email', 'Already registered');
      clear(store.getState());
      store.setState((s) => ({ values: { ...s.values, agree: true } }));
      expect(store.getState().errors).toBeUndefined();
    }
  });

  it('a scoped resetErrors clears only that field for good', () => {
    const store = make();
    store.getState().setError('name', 'Name taken');
    store.getState().setError('email', 'Email taken');
    getScopedFormApi(store, 'email').getState().resetErrors();
    store.setState((s) => ({ values: { ...s.values, agree: true } }));
    expect(store.getState().errors?.email).toBeUndefined();
    expect(store.getState().errors?.name?._errors).toEqual(['Name taken']);
  });

  it('works through a scoped controller and a nested formPath', () => {
    const store = make();
    getScopedFormApi(store, 'email').getState().setError('Taken');
    store.setState((s) => ({ values: { ...s.values, agree: true } }));
    expect(store.getState().errors?.email?._errors).toEqual(['Taken']);

    type App = { form: FormState<Values>; theme: string };
    const app = create<App>()(
      withForm(
        () => ({
          form: { values: { name: 'Ada', email: '', agree: false } },
          theme: 'light',
        }),
        { formPath: 'form', getSchema: () => schema }
      )
    );
    const form = getFormApi(app, 'form');
    getScopedFormApi(form, 'email')
      .getState()
      .setErrors({ _errors: ['Bad'] });
    app.setState({ theme: 'dark' });
    form.setState((f) => ({ values: { ...f.values, agree: true } }));
    expect(app.getState().form.errors?.email?._errors).toEqual(['Bad']);
    form.setState((f) => ({ values: { ...f.values, email: 'x' } }));
    expect(app.getState().form.errors).toBeUndefined();
  });
});
