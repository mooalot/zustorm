import { z } from 'zod';
import { create } from 'zustand';
import { FormController, getDefaultForm, withForm } from 'zustorm';

type Form = {
  friends: {
    name: string;
    age: number;
  }[];
};

const useFriendsForm = create(
  withForm(
    () =>
      getDefaultForm<Form>({
        friends: [],
      }),
    {
      getSchema: () =>
        z.object({
          friends: z.array(
            z.object({
              name: z.string().min(1, 'Name is required'),
              age: z.number().min(0, 'Age must be positive'),
            })
          ),
        }),
    }
  )
);

// Use in component
function FriendsForm() {
  const isValid = useFriendsForm((state) => !state.errors);
  const isDirty = useFriendsForm((state) => state.dirty);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      const formData = useFriendsForm.getState().values;
      console.log('Form submitted:', formData);
      // Handle form submission logic here
    } else {
      console.error('Form is invalid');
    }
  };

  return (
    <form>
      <h2>Friends</h2>
      <FormController
        store={useFriendsForm}
        name="friends"
        render={({ value, onChange }) => (
          <div>
            {value.map((_, index) => (
              <div key={index} style={{ marginBottom: '10px' }}>
                <FormController
                  store={useFriendsForm}
                  name={`friends.${index}.name`}
                  render={({ value: name, onChange: onNameChange, error }) => (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Friend's Name"
                      style={{ borderColor: error ? 'red' : 'gray' }}
                    />
                  )}
                />
                <FormController
                  store={useFriendsForm}
                  name={`friends.${index}.age`}
                  render={({
                    value: age,
                    onChange: onAgeChange,
                    error: ageError,
                  }) => (
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => onAgeChange(Number(e.target.value))}
                      placeholder="Friend's Age"
                      style={{ borderColor: ageError ? 'red' : 'gray' }}
                    />
                  )}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                onChange([
                  ...value,
                  { name: '', age: 0 }, // Add a new friend with default values
                ])
              }
            >
              Add Friend
            </button>
          </div>
        )}
      />
      <button disabled={!isValid || !isDirty} onClick={onSubmit}>
        Submit
      </button>
    </form>
  );
}

export default FriendsForm;
