import { fireEvent, render, screen } from '@testing-library/react';
import React, { useMemo } from 'react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createStore, useStore } from 'zustand';
import {
  createFormStore,
  getDefaultForm,
  getFormApi,
  getScopedApi,
  getScopedFormApi,
  getScopedFormState,
  setWithOptionalPath,
  useFormStore,
  withForm,
} from '../src/utils';
import { FormController, FormStoreProvider } from '../src/components';
import { FormState } from '../src/types';

describe('setWithOptionalPath', () => {
  it('should set a value at the specified path', () => {
    const state = { a: { b: { c: 1 } } };
    setWithOptionalPath(state, 'a.b.c', 2);
    expect(state.a.b.c).toBe(2);
  });
});

describe('getScopedApi', () => {
  it('should return a scoped API with the correct type', () => {
    const api = createStore(() => ({
      test: {
        value: 'initial',
      },
    }));

    const scopedApi = getScopedApi(api, 'test');
    expect(scopedApi.getState().value).toBe('initial');
    scopedApi.setState({ value: 'updated' });
    expect(scopedApi.getState().value).toBe('updated');
  });

  it('should return a scoped API with path as array of strings', () => {
    const api = createStore(() => ({
      test: {
        value: 'initial',
      },
    }));

    const scopedApi = getScopedApi(api, ['test'] as const);
    expect(scopedApi.getState().value).toBe('initial');
    scopedApi.setState({ value: 'updated' });
    expect(scopedApi.getState().value).toBe('updated');
  });
});

describe('getScopedFormState', () => {
  it('should return a scoped form state with the correct type', () => {
    const formState: FormState<{ test: { value: string } }> = {
      values: { test: { value: 'initial' } },
      isSubmitting: false,
    };

    const scopedState = getScopedFormState(formState, 'test');
    expect(scopedState.values.value).toBe('initial');
  });

  it('should return a scoped form state with path as array of strings', () => {
    const formState: FormState<{ test: { value: string } }> = {
      values: { test: { value: 'initial' } },
      isSubmitting: false,
    };

    const scopedState = getScopedFormState(formState, ['test'] as const);
    expect(scopedState.values.value).toBe('initial');
  });
});

describe('getScopedFormApi', () => {
  it('should return a scoped form API with the correct type', () => {
    const formStore = createStore<FormState<{ test: { value: string } }>>(
      () => ({
        values: { test: { value: 'initial' } },
        errors: undefined,
        isSubmitting: false,
      })
    );

    const scopedApi = getScopedFormApi(formStore, 'test');
    expect(scopedApi.getState().values.value).toBe('initial');
    scopedApi.setState({ values: { value: 'updated' } });
    expect(scopedApi.getState().values.value).toBe('updated');
  });

  it('should return a scoped form API with path as array of strings', () => {
    const formStore = createStore<FormState<{ test: { value: string } }>>(
      () => ({
        values: { test: { value: 'initial' } },
        errors: undefined,
        isSubmitting: false,
      })
    );

    const scopedApi = getScopedFormApi(formStore, ['test'] as const);
    expect(scopedApi.getState().values.value).toBe('initial');
    scopedApi.setState({ values: { value: 'updated' } });
    expect(scopedApi.getState().values.value).toBe('updated');
  });

  it('nested scoped variables should be reflected in scoped form API', () => {
    const formStore = createStore<FormState<{ test: { value: string } }>>(
      () => ({
        values: { test: { value: 'initial' } },
        errors: undefined,
        isSubmitting: false,
      })
    );

    const scopedApi = getScopedFormApi(formStore, 'test');
    expect(scopedApi.getState().touched?.value?._touched).toBeUndefined();
    formStore.setState((state) => ({
      ...state,
      touched: { test: { value: { _touched: true } } },
    }));

    expect(scopedApi.getState().touched?.value?._touched).toBe(true);
  });

  it('setting a value in the scoped form API should update the original store', () => {
    const formStore = createStore<FormState<{ test: { value: string } }>>(
      () => ({
        values: { test: { value: 'initial' } },
        errors: undefined,
        isSubmitting: false,
      })
    );

    const scopedApi = getScopedFormApi(formStore, 'test');
    scopedApi.setState({ touched: { value: { _touched: true } } });
    expect(formStore.getState().touched?.test?.value?._touched).toBe(true);
  });
});

// Mock components for testing
const MockChild = () => {
  const store = useFormStore();
  const value = useStore(store, (state) => state.values);
  return <div data-testid="form-state">{JSON.stringify(value)}</div>;
};

describe('form.utils', () => {
  it('should create a form store with default values', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const state = formStore.getState();
    expect(state.values).toEqual(defaultValues);
    expect(state.isSubmitting).toBe(false);
  });

  it('should validate form values against schema', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: '' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const state = formStore.getState();
    expect(state.errors).toBeUndefined();
  });

  it('should provide form context through FormStoreProvider', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    render(
      <FormStoreProvider store={formStore}>
        <MockChild />
      </FormStoreProvider>
    );

    const formState = screen.getByTestId('form-state');
    expect(formState.textContent).toContain('"name":"Test"');
  });

  it('should create a form controller and handle changes', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ value, onChange }) => (
          <input
            data-testid="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    const input = screen.getByTestId('form-input') as HTMLInputElement;
    expect(input.value).toBe('Test');
  });

  it('should return default form structure', () => {
    const defaultValues = { name: 'Test' };
    const form = getDefaultForm(defaultValues);

    expect(form.values).toEqual(defaultValues);
    expect(form.isSubmitting).toBe(false);
  });

  it('should create a plain zustand store and use form controller to access it', () => {
    const defaultValues = { name: 'Plain Store Test' };
    const plainStore = createStore(
      withForm(
        () => ({
          form: getDefaultForm(defaultValues),
        }),
        {
          formPath: 'form',
          getSchema: () => z.object({ name: z.string() }),
        }
      )
    );

    const MockForm = () => {
      return (
        <FormController
          store={getFormApi(plainStore, 'form')}
          name="name"
          render={({ value, onChange }) => (
            <input
              data-testid="plain-store-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        />
      );
    };

    render(<MockForm />);

    const input = screen.getByTestId('plain-store-input') as HTMLInputElement;
    expect(input.value).toBe('Plain Store Test');

    // Simulate user input
    fireEvent.change(input, { target: { value: 'Updated Plain Store' } });

    const state = plainStore.getState();
    expect(state.form.values.name).toBe('Updated Plain Store');
  });

  it('should be able to pass a custom form path to the Form provider', () => {
    const defaultValues = { name: 'Plain Store Test' };
    const plainStore = createStore(
      withForm(
        () => ({
          form: getDefaultForm(defaultValues),
        }),
        {
          formPath: 'form',
          getSchema: () => z.object({ name: z.string() }),
        }
      )
    );

    // create a mock component and its parent component
    const MockChild = () => {
      const store = useFormStore<{ name: string }>();

      return (
        <FormController
          store={store}
          name="name"
          render={({ value, onChange }) => (
            <input
              data-testid="plain-store-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        />
      );
    };

    const MockParent = () => (
      <FormStoreProvider store={getFormApi(plainStore, 'form')}>
        <MockChild />
      </FormStoreProvider>
    );

    render(<MockParent />);

    const input = screen.getByTestId('plain-store-input') as HTMLInputElement;
    expect(input.value).toBe('Plain Store Test');
    // Simulate user input
    fireEvent.change(input, { target: { value: 'Updated Plain Store' } });
    const state = plainStore.getState();
    expect(state.form.values.name).toBe('Updated Plain Store');
  });

  it('should be able to pass a custom name to the form provider', () => {
    const defaultValues = { user: { name: 'Plain Store Test' } };
    const plainStore = createStore(
      withForm(
        () => ({
          form: getDefaultForm(defaultValues),
        }),
        {
          formPath: 'form',
          getSchema: () => z.object({ user: z.object({ name: z.string() }) }),
        }
      )
    );

    // create a mock component and its parent component
    const MockChild = () => {
      const store = useFormStore<{ name: string }>();
      return (
        <FormController
          store={store}
          name="name"
          render={({ value, onChange }) => (
            <input
              data-testid="plain-store-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        />
      );
    };

    const MockParent = () => (
      <FormStoreProvider
        store={getFormApi(plainStore, 'form')}
        options={{ name: 'user' }}
      >
        <MockChild />
      </FormStoreProvider>
    );

    render(<MockParent />);

    const input = screen.getByTestId('plain-store-input') as HTMLInputElement;
    expect(input.value).toBe('Plain Store Test');
  });
});
