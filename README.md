# Zustand Forms

Zustand middleware for managing forms.

## Installation

To use Zustand Forms, you need to install the package along with Zod for schema validation. (I may add support for other validation libraries in the future.)

```bash
npm install zustand-forms zod
```

## Usage Example

```typescript
import { z } from 'zod';
import { create } from 'zustand';
import {
  getDefaultForm,
  FormState,
  createFormController,
  withForm,
} from 'zustand-forms';

type Form = {
  name: string;
};

const useStore = create<FormState<Form>>()(
  withForm(
    () =>
      getDefaultForm({
        name: 'John Doe',
      }),
    {
      getSchema: () =>
        z.object({
          name: z.string().nonempty(),
        }),
    }
  )
);

const FormController = createFormController(useStore);

function Form() {
  const isValid = useStore((state) => state.isValid);
  const isTouched = useStore((state) => state.isTouched);
  const isDirty = useStore((state) => state.isDirty);

  return (
    <FormController
      name="name"
      render={({ value, onChange, error, onBlur }) => (
        <li>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            style={{
              outline: error ? '1px solid red' : undefined,
            }}
          />
        </li>
      )}
    />
  );
}
```
