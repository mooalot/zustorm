import { useMemo, type CSSProperties } from 'react';
import { z } from 'zod';
import { createStore, useStore } from 'zustand';
import {
  FormController,
  FormStoreProvider,
  useFormController,
  useFormStore,
  withForm,
} from 'zustorm';

type UserForm = {
  name: string;
  email: string;
  address: {
    street: string;
    city: string;
    zip: string;
  };
};

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    zip: z.string().min(1, 'ZIP is required'),
  }),
});

function App() {
  // One store per mounted form, handed down through context.
  const store = useMemo(
    () =>
      createStore(
        withForm<UserForm>(
          {
            name: 'John Doe',
            email: 'john@example.com',
            address: {
              street: '123 Main St',
              city: 'Anytown',
              zip: '12345',
            },
          },
          { getSchema: () => schema }
        )
      ),
    []
  );

  return (
    <FormStoreProvider store={store}>
      <UserForm />
    </FormStoreProvider>
  );
}

function UserForm() {
  const store = useFormStore<UserForm>();
  const isValid = useStore(store, (state) => state.isValid);
  const isDirty = useStore(store, (state) => state.isDirty);
  const handleSubmit = useStore(store, (state) => state.handleSubmit);

  const onSubmit = handleSubmit(
    (values) => {
      console.log('Form submitted:', values);
      alert('Form submitted! Check console for data.');
    },
    () => alert('Please fix validation errors before submitting.')
  );

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🔗 Context Example</h1>
      <p>Using React Context with FormStoreProvider</p>

      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <NameField />
        <EmailField />
        <AddressFields />

        <div style={{ marginTop: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <span
              style={{
                color: isValid ? 'green' : 'red',
                marginRight: '16px',
              }}
            >
              {isValid ? '✅ Valid' : '❌ Invalid'}
            </span>
            <span style={{ color: isDirty ? 'orange' : 'blue' }}>
              {isDirty ? '📝 Modified' : '🔒 Unchanged'}
            </span>
          </div>

          <button
            type="submit"
            disabled={!isValid || !isDirty}
            style={{
              padding: '12px 24px',
              backgroundColor: !isValid || !isDirty ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: !isValid || !isDirty ? 'not-allowed' : 'pointer',
            }}
          >
            Submit Form
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = (invalid: boolean): CSSProperties => ({
  width: '100%',
  padding: '8px',
  border: `1px solid ${invalid ? 'red' : 'gray'}`,
});

// The hook form: the same data FormController's render prop receives.
function NameField() {
  const store = useFormStore<UserForm>();
  const { value, onChange, onBlur, errorMessage, isTouched } =
    useFormController(store, 'name');
  return (
    <div>
      <label>Name:</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        style={inputStyle(isTouched && !!errorMessage)}
      />
      {isTouched && errorMessage && (
        <div style={{ color: 'red', fontSize: '12px' }}>{errorMessage}</div>
      )}
    </div>
  );
}

// The render-prop form, with contextSelector reading another field.
function EmailField() {
  const store = useFormStore<UserForm>();
  return (
    <div>
      <label>Email:</label>
      <FormController
        store={store}
        name="email"
        contextSelector={(values) => values.name}
        render={({
          value,
          onChange,
          onBlur,
          errorMessage,
          isTouched,
          context,
        }) => (
          <div>
            <input
              type="email"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              placeholder={`Email for ${context}`}
              style={inputStyle(isTouched && !!errorMessage)}
            />
            {isTouched && errorMessage && (
              <div style={{ color: 'red', fontSize: '12px' }}>
                {errorMessage}
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}

// A nested provider scopes the whole subtree to `address`.
function AddressFields() {
  const store = useFormStore<UserForm>();
  return (
    <FormStoreProvider store={store} options={{ name: 'address' }}>
      <fieldset style={{ border: '1px solid #ccc', padding: '16px' }}>
        <legend>Address</legend>
        <AddressField name="street" label="Street" />
        <AddressField name="city" label="City" />
        <AddressField name="zip" label="ZIP" />
      </fieldset>
    </FormStoreProvider>
  );
}

function AddressField({
  name,
  label,
}: {
  name: 'street' | 'city' | 'zip';
  label: string;
}) {
  const store = useFormStore<UserForm['address']>();
  return (
    <div style={{ marginBottom: '12px' }}>
      <label>{label}:</label>
      <FormController
        store={store}
        name={name}
        render={({ value, onChange, onBlur, errorMessage, isTouched }) => (
          <div>
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              style={inputStyle(isTouched && !!errorMessage)}
            />
            {isTouched && errorMessage && (
              <div style={{ color: 'red', fontSize: '12px' }}>
                {errorMessage}
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}

export default App;
