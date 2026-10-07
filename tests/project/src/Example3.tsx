import { useMemo } from 'react';
import { z } from 'zod';
import { createStore, useStore } from 'zustand';
import {
  FormStoreProvider,
  useFormController,
  useFormStore,
  withForm,
} from 'zustorm';

type Form = {
  name: string;
  email: string;
};

// A per-component store shared through context.
function UserContextForm() {
  const store = useMemo(
    () =>
      createStore(
        withForm<Form>(
          { name: '', email: '' },
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

  const isValid = useStore(store, (state) => state.isValid);
  const isDirty = useStore(store, (state) => state.isDirty);
  const handleSubmit = useStore(store, (state) => state.handleSubmit);

  return (
    <form
      onSubmit={handleSubmit((values) =>
        console.log('Form submitted:', values)
      )}
    >
      <FormStoreProvider store={store}>
        <Field name="name" placeholder="Name" />
        <Field name="email" placeholder="Email" />
      </FormStoreProvider>
      <button type="submit" disabled={!isValid || !isDirty}>
        Submit
      </button>
    </form>
  );
}

// useFormController is the hook form of FormController.
function Field({
  name,
  placeholder,
}: {
  name: keyof Form;
  placeholder: string;
}) {
  const store = useFormStore<Form>();
  const { value, onChange, onBlur, errorMessage, isTouched } =
    useFormController(store, name);
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      title={isTouched ? errorMessage : undefined}
      style={{ borderColor: isTouched && errorMessage ? 'red' : 'gray' }}
    />
  );
}

export default UserContextForm;
