import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createStore } from 'zustand';
import {
  createFormComputer,
  createFormController,
  createFormStore,
  getDefaultForm,
  useFormStoreContext,
} from '../src/utils';
import { FormStoreProvider } from '../src/components';
import { FormState } from '../src/types';

// Mock components for testing
const MockChild = () => {
  const store = useFormStoreContext();
  const state = store.getState();
  return <div data-testid="form-state">{JSON.stringify(state)}</div>;
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
    expect(state.isValid).toBe(true);
    expect(state.isDirty).toBe(false);
    expect(state.isSubmitting).toBe(false);
  });

  it('should validate form values against schema', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: '' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const state = formStore.getState();
    expect(state.isValid).toBe(true);
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

    const FormController = createFormController(formStore);

    const MockForm = () => (
      <FormController
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

    // Simulate user input
    fireEvent.change(input, { target: { value: 'Updated' } });

    const state = formStore.getState();
    expect(state.values.name).toBe('Updated');
  });

  it('should return default form structure', () => {
    const defaultValues = { name: 'Test' };
    const form = getDefaultForm(defaultValues);

    expect(form.values).toEqual(defaultValues);
    expect(form.isValid).toBe(true);
    expect(form.isDirty).toBe(false);
    expect(form.isSubmitting).toBe(false);
  });

  it('should create a plain zustand store and use form controller to access it', () => {
    const defaultValues = { name: 'Plain Store Test' };
    const computer = createFormComputer<{
      form: FormState<{ name: string }>;
    }>()({
      formPath: 'form',
      getSchema: () => z.object({ name: z.string() }),
    });
    const plainStore = createStore(
      computer(() => ({
        form: getDefaultForm(defaultValues),
      }))
    );

    const FormController = createFormController(plainStore, {
      formPath: 'form',
    });

    const MockForm = () => (
      <FormController
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

    render(
      <FormStoreProvider store={plainStore}>
        <MockForm />
      </FormStoreProvider>
    );

    const input = screen.getByTestId('plain-store-input') as HTMLInputElement;
    expect(input.value).toBe('Plain Store Test');

    // Simulate user input
    fireEvent.change(input, { target: { value: 'Updated Plain Store' } });

    const state = plainStore.getState();
    expect(state.form.values.name).toBe('Updated Plain Store');
  });

  it('should be able to create a form controller with custom path', () => {
    const schema = z.object({ user: z.object({ name: z.string() }) });
    const defaultValues = { user: { name: 'Test' } };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const FormController = createFormController(formStore, {
      name: 'user',
    });

    const MockForm = () => (
      <FormController
        name="name"
        render={({ value, onChange }) => (
          <input
            data-testid="custom-path-input"
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

    const input = screen.getByTestId('custom-path-input') as HTMLInputElement;
    expect(input.value).toBe('Test');

    // Simulate user input
    fireEvent.change(input, { target: { value: 'Updated Custom Path' } });

    const state = formStore.getState();
    expect(state.values.user.name).toBe('Updated Custom Path');
  });

  it('should be able to pass a custom form path to the Form provider', () => {
    const defaultValues = { name: 'Plain Store Test' };
    const computer = createFormComputer<{
      form: FormState<{ name: string }>;
    }>()({
      formPath: 'form',
      getSchema: () => z.object({ name: z.string() }),
    });
    const plainStore = createStore(
      computer(() => ({
        form: getDefaultForm(defaultValues),
      }))
    );

    // create a mock component and its parent component
    const MockChild = () => {
      const store = useFormStoreContext<{ name: string }>();
      const FormController = createFormController(store);

      return (
        <FormController
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
      <FormStoreProvider store={plainStore} options={{ formPath: 'form' }}>
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
    const computer = createFormComputer<{
      form: FormState<{ user: { name: string } }>;
    }>()({
      formPath: 'form',
      getSchema: () => z.object({ user: z.object({ name: z.string() }) }),
    });
    const plainStore = createStore(
      computer(() => ({
        form: getDefaultForm(defaultValues),
      }))
    );

    // create a mock component and its parent component
    const MockChild = () => {
      const store = useFormStoreContext<{ name: string }>();
      const FormController = createFormController(store);

      return (
        <FormController
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
        store={plainStore}
        options={{ formPath: 'form', name: 'user' }}
      >
        <MockChild />
      </FormStoreProvider>
    );

    render(<MockParent />);

    const input = screen.getByTestId('plain-store-input') as HTMLInputElement;
    expect(input.value).toBe('Plain Store Test');
  });
});
