import { useMemo } from 'react';
import { z } from 'zod';
import { useStore } from 'zustand';
import {
  FormStoreProvider,
  FormController,
  createFormStore,
  useFormStore,
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

function App() {
  const store = useMemo(
    () =>
      createFormStore<UserForm>(
        {
          name: 'John Doe',
          email: 'john@example.com',
          address: {
            street: '123 Main St',
            city: 'Anytown',
            zip: '12345',
          },
        },
        {
          getSchema: () =>
            z.object({
              name: z.string().min(1, 'Name is required'),
              email: z.string().email('Invalid email'),
              address: z.object({
                street: z.string().min(1, 'Street is required'),
                city: z.string().min(1, 'City is required'),
                zip: z.string().min(1, 'ZIP is required'),
              }),
            }),
        }
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
  const isValid = useStore(store, (state) => !state.errors);
  const isDirty = useStore(
    store,
    (state) => state.dirty && Object.keys(state.dirty).length > 0
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      const formData = store.getState().values;
      console.log('Form submitted:', formData);
      alert('Form submitted! Check console for data.');
    } else {
      alert('Please fix validation errors before submitting.');
    }
  };

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

function NameField() {
  const store = useFormStore<UserForm>();
  return (
    <div>
      <label>Name:</label>
      <FormController
        store={store}
        name="name"
        render={({ value, onChange, error }) => (
          <div>
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderColor: error ? 'red' : 'gray',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            />
            {error && (
              <div style={{ color: 'red', fontSize: '12px' }}>{error}</div>
            )}
          </div>
        )}
      />
    </div>
  );
}

function EmailField() {
  const store = useFormStore<UserForm>();
  return (
    <div>
      <label>Email:</label>
      <FormController
        store={store}
        name="email"
        render={({ value, onChange, error }) => (
          <div>
            <input
              type="email"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderColor: error ? 'red' : 'gray',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            />
            {error && (
              <div style={{ color: 'red', fontSize: '12px' }}>{error}</div>
            )}
          </div>
        )}
      />
    </div>
  );
}

function AddressFields() {
  const store = useFormStore<UserForm>();
  return (
    <fieldset style={{ border: '1px solid #ccc', padding: '16px' }}>
      <legend>Address</legend>

      <div style={{ marginBottom: '12px' }}>
        <label>Street:</label>
        <FormController
          store={store}
          name="address.street"
          render={({ value, onChange, error }) => (
            <div>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderColor: error ? 'red' : 'gray',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              />
              {error && (
                <div style={{ color: 'red', fontSize: '12px' }}>{error}</div>
              )}
            </div>
          )}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label>City:</label>
        <FormController
          store={store}
          name="address.city"
          render={({ value, onChange, error }) => (
            <div>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderColor: error ? 'red' : 'gray',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              />
              {error && (
                <div style={{ color: 'red', fontSize: '12px' }}>{error}</div>
              )}
            </div>
          )}
        />
      </div>

      <div>
        <label>ZIP:</label>
        <FormController
          store={store}
          name="address.zip"
          render={({ value, onChange, error }) => (
            <div>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderColor: error ? 'red' : 'gray',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              />
              {error && (
                <div style={{ color: 'red', fontSize: '12px' }}>{error}</div>
              )}
            </div>
          )}
        />
      </div>
    </fieldset>
  );
}

export default App;
