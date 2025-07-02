import { z } from 'zod';
import { create } from 'zustand';
import { getDefaultForm, FormState, FormController, withForm } from 'zustorm';

type UserForm = {
  name: string;
  email: string;
  address: {
    street: string;
    city: string;
    zip: string;
  };
};

const useUserForm = create<FormState<UserForm>>()(
  withForm(
    () =>
      getDefaultForm<UserForm>({
        name: 'John Doe',
        email: 'john@example.com',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          zip: '12345',
        },
      }),
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
  )
);

function App() {
  const isValid = useUserForm((state) => !state.errors);
  const isDirty = useUserForm(
    (state) => state.dirty && Object.keys(state.dirty).length > 0
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      const formData = useUserForm.getState().values;
      console.log('Form submitted:', formData);
      alert('Form submitted! Check console for data.');
    } else {
      alert('Please fix validation errors before submitting.');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🌐 Global State Example</h1>
      <p>Using Zustand global store with withForm enhancement</p>

      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <div>
          <label>Name:</label>
          <FormController
            store={useUserForm}
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
                  <div style={{ color: 'red', fontSize: '12px' }}>
                    {JSON.stringify(error)}
                  </div>
                )}
              </div>
            )}
          />
        </div>

        <div>
          <label>Email:</label>
          <FormController
            store={useUserForm}
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
                  <div style={{ color: 'red', fontSize: '12px' }}>
                    {' '}
                    {JSON.stringify(error)}
                  </div>
                )}
              </div>
            )}
          />
        </div>

        <fieldset style={{ border: '1px solid #ccc', padding: '16px' }}>
          <legend>Address</legend>

          <div style={{ marginBottom: '12px' }}>
            <label>Street:</label>
            <FormController
              store={useUserForm}
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
                    <div style={{ color: 'red', fontSize: '12px' }}>
                      {JSON.stringify(error)}
                    </div>
                  )}
                </div>
              )}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label>City:</label>
            <FormController
              store={useUserForm}
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
                    <div style={{ color: 'red', fontSize: '12px' }}>
                      {JSON.stringify(error)}
                    </div>
                  )}
                </div>
              )}
            />
          </div>

          <div>
            <label>ZIP:</label>
            <FormController
              store={useUserForm}
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
                    <div style={{ color: 'red', fontSize: '12px' }}>
                      {JSON.stringify(error)}
                    </div>
                  )}
                </div>
              )}
            />
          </div>
        </fieldset>

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

export default App;
