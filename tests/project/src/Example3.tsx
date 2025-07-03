import { useMemo } from 'react';
import { z } from 'zod';
import { createStore, useStore } from 'zustand';
import {
  FormController,
  FormStoreProvider,
  getDefaultForm,
  useFormStore,
  withForm,
} from 'zustorm';

type Form = {
  name: string;
  email: string;
};

function UserContextForm() {
  const store = useMemo(
    () =>
      createStore(
        withForm(
          () =>
            getDefaultForm<Form>({
              name: '',
              email: '',
            }),
          {
            getSchema: () =>
              z.object({
                name: z.string().min(1, 'Name is required'),
                email: z.string().email('Invalid email'),
              }),
          }
        )
      ),
    []
  );

  const isValid = useStore(store, (state) => !state.errors);
  const isDirty = useStore(store, (state) => state.dirty);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      const formData = store.getState().values;
      console.log('Form submitted:', formData);
      // Handle form submission logic here
    } else {
      console.error('Form is invalid');
    }
  };

  return (
    <form>
      <FormStoreProvider store={store}>
        <NameField />
        <EmailField />
      </FormStoreProvider>
      <button disabled={!isValid || !isDirty} onClick={onSubmit}>
        Submit
      </button>
    </form>
  );
}

function NameField() {
  const store = useFormStore<Form>();
  return (
    <FormController
      store={store}
      name="name"
      render={({ value, onChange, error }) => (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Name"
          style={{ borderColor: error ? 'red' : 'gray' }}
        />
      )}
    />
  );
}

function EmailField() {
  const store = useFormStore<Form>();
  return (
    <FormController
      store={store}
      name="email"
      render={({ value, onChange, error }) => (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Email"
          style={{ borderColor: error ? 'red' : 'gray' }}
        />
      )}
    />
  );
}

export default UserContextForm;
