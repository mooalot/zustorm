import { z } from 'zod';
import { create } from 'zustand';
import { FormController, withForm } from 'zustorm';

type Friend = {
  name: string;
  age: number;
  email: string;
};

type FriendsForm = {
  friends: Friend[];
};

const emptyFriend: Friend = { name: '', age: 0, email: '' };

const useFriendsForm = create(
  withForm<FriendsForm>(
    { friends: [emptyFriend] },
    {
      getSchema: () =>
        z.object({
          friends: z
            .array(
              z.object({
                name: z.string().min(1, 'Name is required'),
                age: z.number().min(1, 'Age must be positive'),
                email: z.string().email('Invalid email address'),
              })
            )
            .min(1, 'At least one friend is required'),
        }),
    }
  )
);

function FriendField({
  index,
  field,
  label,
  type = 'text',
}: {
  index: number;
  field: keyof Friend;
  label: string;
  type?: string;
}) {
  return (
    <FormController
      store={useFriendsForm}
      name={`friends.${index}.${field}`}
      render={({ value, onChange, onBlur, errorMessage, isTouched }) => (
        <div style={{ marginBottom: '10px' }}>
          <label>{label}:</label>
          <input
            type={type}
            value={value}
            onChange={(e) =>
              onChange(
                (type === 'number'
                  ? Number(e.target.value)
                  : e.target.value) as Friend[typeof field]
              )
            }
            onBlur={onBlur}
            placeholder={label}
            style={{ marginLeft: '10px', padding: '5px' }}
          />
          {isTouched && errorMessage && (
            <div style={{ color: 'red', fontSize: '12px' }}>{errorMessage}</div>
          )}
        </div>
      )}
    />
  );
}

function App() {
  const isValid = useFriendsForm((state) => state.isValid);
  const isDirty = useFriendsForm((state) => state.isDirty);
  const handleSubmit = useFriendsForm((state) => state.handleSubmit);

  const onSubmit = handleSubmit((values) => {
    console.log('Form submitted:', values);
    alert('Form submitted! Check console for data.');
  });

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px' }}>
      <h1>Zustorm Array Example</h1>

      <form onSubmit={onSubmit}>
        <h2>Friends List</h2>

        <FormController
          store={useFriendsForm}
          name="friends"
          render={({ value, onChange, errorMessage }) => (
            <div>
              {value.map((_, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '20px',
                    padding: '15px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                  }}
                >
                  <h3>Friend #{index + 1}</h3>

                  <FriendField index={index} field="name" label="Name" />
                  <FriendField
                    index={index}
                    field="age"
                    label="Age"
                    type="number"
                  />
                  <FriendField index={index} field="email" label="Email" />

                  {value.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(value.filter((_, i) => i !== index))
                      }
                      style={{
                        background: 'red',
                        color: 'white',
                        padding: '5px 10px',
                        border: 'none',
                        borderRadius: '3px',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              {/* The array's own errors (e.g. the min length), not its items'. */}
              {errorMessage && (
                <div style={{ color: 'red' }}>{errorMessage}</div>
              )}

              <button
                type="button"
                onClick={() => onChange((friends) => [...friends, emptyFriend])}
                style={{
                  background: 'green',
                  color: 'white',
                  padding: '10px 15px',
                  border: 'none',
                  borderRadius: '3px',
                  marginBottom: '20px',
                }}
              >
                Add Friend
              </button>
            </div>
          )}
        />

        <div style={{ marginTop: '20px' }}>
          <p>Form is {isValid ? 'valid' : 'invalid'}</p>
          <p>Form is {isDirty ? 'modified' : 'unchanged'}</p>

          <button
            type="submit"
            disabled={!isValid || !isDirty}
            style={{
              background: !isValid || !isDirty ? '#ccc' : 'blue',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '3px',
              cursor: !isValid || !isDirty ? 'not-allowed' : 'pointer',
            }}
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;
