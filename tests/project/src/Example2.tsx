import { z } from 'zod';
import { create } from 'zustand';
import { FormController, withForm } from 'zustorm';

type Form = {
  friends: {
    name: string;
    age: number;
  }[];
};

// A creator returning `{ values }` plus extra state of your own. The store
// type is inferred from what the creator returns.
const useFriendsForm = create(
  withForm(
    () => ({
      values: { friends: [] } as Form,
      submitCount: 0,
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

function FriendsForm() {
  const isValid = useFriendsForm((state) => state.isValid);
  const isDirty = useFriendsForm((state) => state.isDirty);
  const submitCount = useFriendsForm((state) => state.submitCount);
  const handleSubmit = useFriendsForm((state) => state.handleSubmit);

  const onSubmit = handleSubmit((values) => {
    console.log('Form submitted:', values);
    useFriendsForm.setState((state) => ({
      submitCount: state.submitCount + 1,
    }));
  });

  return (
    <form onSubmit={onSubmit}>
      <h2>Friends (submitted {submitCount} times)</h2>
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
                  render={({
                    value: name,
                    onChange: onNameChange,
                    errorMessage,
                  }) => (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Friend's Name"
                      style={{ borderColor: errorMessage ? 'red' : 'gray' }}
                    />
                  )}
                />
                <FormController
                  store={useFriendsForm}
                  name={`friends.${index}.age`}
                  render={({
                    value: age,
                    onChange: onAgeChange,
                    errorMessage,
                  }) => (
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => onAgeChange(Number(e.target.value))}
                      placeholder="Friend's Age"
                      style={{ borderColor: errorMessage ? 'red' : 'gray' }}
                    />
                  )}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange([...value, { name: '', age: 0 }])}
            >
              Add Friend
            </button>
          </div>
        )}
      />
      <button type="submit" disabled={!isValid || !isDirty}>
        Submit
      </button>
    </form>
  );
}

export default FriendsForm;
