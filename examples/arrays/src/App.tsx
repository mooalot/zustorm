import { z } from 'zod';
import { create } from 'zustand';
import { FormController, getDefaultForm, withForm, FormState } from 'zustorm';

type FriendsForm = {
  friends: {
    name: string;
    age: number;
    email: string;
  }[];
};

const useFriendsForm = create<FormState<FriendsForm>>()(
  withForm(
    () =>
      getDefaultForm<FriendsForm>({
        friends: [{ name: '', age: 0, email: '' }],
      }),
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

function App() {
  const isValid = useFriendsForm((state) => !state.errors);
  const isDirty = useFriendsForm((state) => state.dirty);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      const formData = useFriendsForm.getState().values;
      console.log('Form submitted:', formData);
      alert('Form submitted! Check console for data.');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px' }}>
      <h1>Zustorm Array Example</h1>

      <form onSubmit={onSubmit}>
        <h2>Friends List</h2>

        <FormController
          store={useFriendsForm}
          name="friends"
          render={({ value, onChange }) => (
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

                  <div>
                    <FormController
                      store={useFriendsForm}
                      name={`friends.${index}.name`}
                      render={({
                        value: name,
                        onChange: onNameChange,
                        error,
                      }) => (
                        <div style={{ marginBottom: '10px' }}>
                          <label>Name:</label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => onNameChange(e.target.value)}
                            placeholder="Enter name"
                            style={{ marginLeft: '10px', padding: '5px' }}
                          />
                          {error && (
                            <div style={{ color: 'red', fontSize: '12px' }}>
                              {JSON.stringify(error)}
                            </div>
                          )}
                        </div>
                      )}
                    />

                    <FormController
                      store={useFriendsForm}
                      name={`friends.${index}.age`}
                      render={({
                        value: age,
                        onChange: onAgeChange,
                        error,
                      }) => (
                        <div style={{ marginBottom: '10px' }}>
                          <label>Age:</label>
                          <input
                            type="number"
                            value={age}
                            onChange={(e) =>
                              onAgeChange(Number(e.target.value))
                            }
                            placeholder="Age"
                            style={{ marginLeft: '10px', padding: '5px' }}
                          />
                          {error && (
                            <div style={{ color: 'red', fontSize: '12px' }}>
                              {JSON.stringify(error)}
                            </div>
                          )}
                        </div>
                      )}
                    />

                    <FormController
                      store={useFriendsForm}
                      name={`friends.${index}.email`}
                      render={({
                        value: email,
                        onChange: onEmailChange,
                        error,
                      }) => (
                        <div style={{ marginBottom: '10px' }}>
                          <label>Email:</label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => onEmailChange(e.target.value)}
                            placeholder="friend@example.com"
                            style={{ marginLeft: '10px', padding: '5px' }}
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

                  {value.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newFriends = value.filter((_, i) => i !== index);
                        onChange(newFriends);
                      }}
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

              <button
                type="button"
                onClick={() => {
                  console.log('Adding new friend', value);
                  onChange((value) => [
                    ...value,
                    { name: '', age: 0, email: '' },
                  ]);
                }}
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
