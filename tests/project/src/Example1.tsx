import { z } from 'zod';
import { create } from 'zustand';
import { withForm, getDefaultForm, FormController } from 'zustorm';

type Form = {
  name: string;
  email: string;
};

const useUserForm = create(
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
);

// Use in component
function UserForm() {
  const isValid = useUserForm((state) => !state.errors);
  const isDirty = useUserForm((state) => state.dirty);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      const formData = useUserForm.getState().values;
      console.log('Form submitted:', formData);
      // Handle form submission logic here
    } else {
      console.error('Form is invalid');
    }
  };

  return (
    <form>
      <FormController
        store={useUserForm}
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
      <FormController
        store={useUserForm}
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
      <button disabled={!isValid || !isDirty} onClick={onSubmit}>
        Submit
      </button>
    </form>
  );
}

export default UserForm;
