import { z } from 'zod';
import { create } from 'zustand';
import { FormController, withForm } from 'zustorm';

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

// Pass the initial values straight to withForm. Everything else (flags,
// actions, errors, touched and dirty trees) is added by the middleware.
const useUserForm = create(
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
);

const inputStyle = (invalid: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '8px',
  border: `1px solid ${invalid ? 'red' : 'gray'}`,
});

function Field({
  name,
  label,
  type = 'text',
}: {
  name: 'name' | 'email' | 'address.street' | 'address.city' | 'address.zip';
  label: string;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label>{label}:</label>
      <FormController
        store={useUserForm}
        name={name}
        render={({ value, onChange, onBlur, errorMessage, isTouched }) => (
          <div>
            <input
              type={type}
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

function App() {
  const isValid = useUserForm((state) => state.isValid);
  const isDirty = useUserForm((state) => state.isDirty);
  const handleSubmit = useUserForm((state) => state.handleSubmit);
  const reset = useUserForm((state) => state.reset);

  const onSubmit = handleSubmit(
    (values) => {
      console.log('Form submitted:', values);
      alert('Form submitted! Check console for data.');
      // Make the submitted values the new baseline.
      reset(values);
    },
    () => alert('Please fix validation errors before submitting.')
  );

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🌐 Global State Example</h1>
      <p>Using a global Zustand store enhanced with withForm</p>

      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <Field name="name" label="Name" />
        <Field name="email" label="Email" type="email" />

        <fieldset style={{ border: '1px solid #ccc', padding: '16px' }}>
          <legend>Address</legend>
          <Field name="address.street" label="Street" />
          <Field name="address.city" label="City" />
          <Field name="address.zip" label="ZIP" />
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
          <button
            type="button"
            disabled={!isDirty}
            onClick={() => reset()}
            style={{ marginLeft: '8px', padding: '12px 24px' }}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;
