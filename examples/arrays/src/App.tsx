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
  const errors = useFriendsForm((state) => state.errors);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      const formData = useFriendsForm.getState().values;
      console.log('Form submitted:', formData);
      alert('Form submitted! Check console for data.');
    } else {
      console.error('Form is invalid:', errors);
      alert('Please fix validation errors before submitting.');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🔄 Zustorm Array Example</h1>
        <p>Dynamic friend list with validation and styling</p>
      </header>

      <form onSubmit={onSubmit} className="form">
        <div className="form-section">
          <h2>Friends List</h2>
          <FormController
            store={useFriendsForm}
            name="friends"
            render={({ value, onChange }) => (
              <div className="friends-container">
                {value.map((_, index) => (
                  <div key={index} className="friend-card">
                    <div className="friend-header">
                      <h3>Friend #{index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => {
                          const newFriends = value.filter(
                            (_, i) => i !== index
                          );
                          onChange(newFriends);
                        }}
                        disabled={value.length === 1}
                        className={`remove-btn ${
                          value.length === 1 ? 'disabled' : ''
                        }`}
                        aria-label={`Remove friend ${index + 1}`}
                      >
                        ✕ Remove
                      </button>
                    </div>

                    <div className="friend-fields">
                      <FormController
                        store={useFriendsForm}
                        name={`friends.${index}.name`}
                        render={({
                          value: name,
                          onChange: onNameChange,
                          error,
                        }) => (
                          <div className="field-group">
                            <label htmlFor={`name-${index}`}>Name</label>
                            <input
                              id={`name-${index}`}
                              type="text"
                              value={name}
                              onChange={(e) => onNameChange(e.target.value)}
                              placeholder="Enter friend's name"
                              className={error ? 'error' : ''}
                              aria-describedby={
                                error ? `name-error-${index}` : undefined
                              }
                            />
                            {error && (
                              <span
                                id={`name-error-${index}`}
                                className="error-message"
                              >
                                {error}
                              </span>
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
                          <div className="field-group">
                            <label htmlFor={`age-${index}`}>Age</label>
                            <input
                              id={`age-${index}`}
                              type="number"
                              value={age}
                              onChange={(e) =>
                                onAgeChange(Number(e.target.value))
                              }
                              placeholder="Age"
                              min="1"
                              max="120"
                              className={error ? 'error' : ''}
                              aria-describedby={
                                error ? `age-error-${index}` : undefined
                              }
                            />
                            {error && (
                              <span
                                id={`age-error-${index}`}
                                className="error-message"
                              >
                                {error}
                              </span>
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
                          <div className="field-group">
                            <label htmlFor={`email-${index}`}>Email</label>
                            <input
                              id={`email-${index}`}
                              type="email"
                              value={email}
                              onChange={(e) => onEmailChange(e.target.value)}
                              placeholder="friend@example.com"
                              className={error ? 'error' : ''}
                              aria-describedby={
                                error ? `email-error-${index}` : undefined
                              }
                            />
                            {error && (
                              <span
                                id={`email-error-${index}`}
                                className="error-message"
                              >
                                {error}
                              </span>
                            )}
                          </div>
                        )}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    onChange([...value, { name: '', age: 0, email: '' }])
                  }
                  className="add-friend-btn"
                >
                  ➕ Add Another Friend
                </button>
              </div>
            )}
          />
        </div>

        <div className="form-actions">
          <div className="form-status">
            <span className={`status ${isValid ? 'valid' : 'invalid'}`}>
              {isValid ? '✅ Form is valid' : '❌ Form has errors'}
            </span>
            <span className={`status ${isDirty ? 'dirty' : 'clean'}`}>
              {isDirty ? '📝 Form modified' : '🔒 Form unchanged'}
            </span>
          </div>

          <button
            type="submit"
            disabled={!isValid || !isDirty}
            className={`submit-btn ${!isValid || !isDirty ? 'disabled' : ''}`}
          >
            🚀 Submit Friends List
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;
