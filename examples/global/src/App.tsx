import type { CSSProperties } from 'react';
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

const inputStyle = (invalid: boolean): CSSProperties => ({
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

// A stand-in for an API call: slow, and it rejects one particular email.
async function saveUser(values: UserForm): Promise<{ emailTaken: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { emailTaken: values.email === 'taken@example.com' };
}

function App() {
  const isValid = useUserForm((state) => state.isValid);
  const isDirty = useUserForm((state) => state.isDirty);
  const isSubmitting = useUserForm((state) => state.isSubmitting);
  const handleSubmit = useUserForm((state) => state.handleSubmit);
  const reset = useUserForm((state) => state.reset);
  const setError = useUserForm((state) => state.setError);

  // isSubmitting is true until this callback settles. A server-side rejection
  // is written back into the form with setError; it shows under the field and
  // clears as soon as the field is edited again.
  const onSubmit = handleSubmit(
    async (values) => {
      const result = await saveUser(values);
      if (result.emailTaken) {
        setError('email', 'This email is already registered');
        return;
      }
      console.log('Form submitted:', values);
      // Make the submitted values the new baseline.
      reset(values);
    },
    () => alert('Please fix validation errors before submitting.')
  );
  const busy = isSubmitting || !isValid || !isDirty;

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🌐 Global State Example</h1>
      <p>Using a global Zustand store enhanced with withForm</p>
      <p style={{ fontSize: '14px', color: '#666' }}>
        Submitting takes 1.5 s. Try the email <code>taken@example.com</code> to
        see a server error written back into the form.
      </p>

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
            disabled={busy}
            style={{
              padding: '12px 24px',
              backgroundColor: busy ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? 'Saving…' : 'Submit Form'}
          </button>
          <button
            type="button"
            disabled={!isDirty || isSubmitting}
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
