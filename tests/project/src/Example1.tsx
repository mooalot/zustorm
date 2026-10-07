import { z } from 'zod';
import { create } from 'zustand';
import { FormController, withForm } from 'zustorm';

type Form = {
  name: string;
  email: string;
};

// Initial values go straight into withForm; the store type is inferred.
const useUserForm = create(
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
);

function UserForm() {
  const isValid = useUserForm((state) => state.isValid);
  const isDirty = useUserForm((state) => state.isDirty);
  const handleSubmit = useUserForm((state) => state.handleSubmit);

  return (
    <form
      onSubmit={handleSubmit(
        (values) => console.log('Form submitted:', values),
        (errors) => console.error('Form is invalid', errors)
      )}
    >
      <FormController
        store={useUserForm}
        name="name"
        render={({ value, onChange, onBlur, errorMessage, isTouched }) => (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder="Name"
            title={isTouched ? errorMessage : undefined}
            style={{ borderColor: isTouched && errorMessage ? 'red' : 'gray' }}
          />
        )}
      />
      <FormController
        store={useUserForm}
        name="email"
        render={({ value, onChange, onBlur, errorMessage, isTouched }) => (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder="Email"
            title={isTouched ? errorMessage : undefined}
            style={{ borderColor: isTouched && errorMessage ? 'red' : 'gray' }}
          />
        )}
      />
      <button type="submit" disabled={!isValid || !isDirty}>
        Submit
      </button>
    </form>
  );
}

export default UserForm;
