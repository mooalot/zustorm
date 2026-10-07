/**
 * A form store is a plain Zustand store, so Zustand's own middlewares compose
 * with `withForm`. These pin the two people reach for first.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { FormState, withForm } from '../src';

type User = { name: string; email: string };
const schema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Invalid email'),
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('Zustand middleware composition', () => {
  it('devtools wraps a form store without changing its behaviour', () => {
    const useForm = create<FormState<User>>()(
      devtools(
        withForm<User>({ name: '', email: 'x' }, { getSchema: () => schema }),
        { enabled: false }
      )
    );
    expect(useForm.getState().isValid).toBe(false);
    useForm.getState().setError('email', 'Taken');
    expect(useForm.getState().errors?.email?._errors).toEqual(['Taken']);
    useForm.setState({ values: { name: 'Ada', email: 'ada@example.com' } });
    expect(useForm.getState().isValid).toBe(true);
    expect(useForm.getState().isDirty).toBe(true);
  });

  it('persist: restored state is adopted as is and validated', async () => {
    const storage = memoryStorage();
    const make = () =>
      create(
        persist(
          withForm<User>({ name: '', email: '' }, { getSchema: () => schema }),
          {
            name: 'user-form',
            storage: createJSONStorage(() => storage),
            partialize: (state) => ({ values: state.values }),
          }
        )
      );

    const first = make();
    expect(first.getState().isValid).toBe(false);
    first.setState({ values: { name: 'Ada', email: 'ada@example.com' } });
    expect(JSON.parse(storage.getItem('user-form')!).state).toEqual({
      values: { name: 'Ada', email: 'ada@example.com' },
    });

    const second = make();
    const state = second.getState();
    expect(state.values.name).toBe('Ada');
    // Errors reflect the restored values, which are not treated as edits.
    expect(state.isValid).toBe(true);
    expect(state.errors).toBeUndefined();
    expect(state.isDirty).toBe(false);
    expect(state.isTouched).toBe(false);
    // Only values were persisted, so the baseline is still the default.
    second.getState().reset();
    expect(second.getState().values.name).toBe('');
    expect(second.getState().isValid).toBe(false);
  });

  it('persist: initialValues, touched and dirty restore when persisted', async () => {
    const storage = memoryStorage();
    const make = () =>
      create(
        persist(
          withForm<User>({ name: '', email: '' }, { getSchema: () => schema }),
          {
            name: 'user-form',
            storage: createJSONStorage(() => storage),
            partialize: ({ values, initialValues, touched, dirty }) => ({
              values,
              initialValues,
              touched,
              dirty,
            }),
          }
        )
      );

    const first = make();
    first.getState().reset({ name: 'Ada', email: 'ada@example.com' });
    first.setState({ values: { name: 'Ada B', email: 'ada@example.com' } });
    expect(first.getState().isDirty).toBe(true);

    const second = make();
    expect(second.getState().values.name).toBe('Ada B');
    expect(second.getState().isDirty).toBe(true);
    expect(second.getState().dirty?.name?._dirty).toBe(true);
    second.getState().reset();
    expect(second.getState().values.name).toBe('Ada');
    expect(second.getState().isDirty).toBe(false);
  });
});
