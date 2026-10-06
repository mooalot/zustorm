/**
 * zustorm vs react-hook-form benchmarks. Run with `npm run bench`.
 *
 * Every scenario mounts the form once (in `setup`) and then times the
 * interaction alone, so the numbers are per keystroke / per submit. jsdom
 * event dispatch is part of every measurement and is the same for both.
 *
 * rhf (register) is react-hook-form's uncontrolled fast path.
 * rhf (Controller) is its controlled path, the closest match to zustorm's
 * FormController.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { bench, describe } from 'vitest';
import {
  createZustormStore,
  makeSchema,
  makeValues,
  RhfForm,
  ZustormForm,
} from './fixtures';

const SIZES = [20, 100, 500];
const OPTIONS = { time: 1000, warmupTime: 200 };

let counter = 0;
/**
 * Types one character and flushes React work and microtasks, so asynchronous
 * validation (react-hook-form resolvers return promises) is included in the
 * measurement for every library.
 */
async function typeInto(testId: string) {
  await act(async () => {
    fireEvent.change(screen.getByTestId(testId), {
      target: { value: `typed ${counter++}` },
    });
  });
}

async function submit(testId: string) {
  await act(async () => {
    fireEvent.submit(screen.getByTestId(testId));
  });
}

for (const n of SIZES) {
  describe(`mount a ${n}-field form`, () => {
    bench(
      'zustorm',
      () => {
        render(<ZustormForm store={createZustormStore(n, true)} n={n} />);
        cleanup();
      },
      OPTIONS
    );
    bench(
      'rhf (register)',
      () => {
        render(<RhfForm n={n} validate />);
        cleanup();
      },
      OPTIONS
    );
    bench(
      'rhf (Controller)',
      () => {
        render(<RhfForm n={n} validate controlled />);
        cleanup();
      },
      OPTIONS
    );
  });

  describe(`type one character into 1 of ${n} fields, no schema`, () => {
    bench('zustorm', async () => typeInto(`z-${n >> 1}`), {
      ...OPTIONS,
      setup: () =>
        void render(<ZustormForm store={createZustormStore(n, false)} n={n} />),
      teardown: cleanup,
    });
    bench('rhf (register)', async () => typeInto(`r-${n >> 1}`), {
      ...OPTIONS,
      setup: () => void render(<RhfForm n={n} validate={false} />),
      teardown: cleanup,
    });
    bench('rhf (Controller)', async () => typeInto(`r-${n >> 1}`), {
      ...OPTIONS,
      setup: () => void render(<RhfForm n={n} validate={false} controlled />),
      teardown: cleanup,
    });
  });

  describe(`type one character into 1 of ${n} fields, zod schema on change`, () => {
    bench('zustorm', async () => typeInto(`z-${n >> 1}`), {
      ...OPTIONS,
      setup: () =>
        void render(<ZustormForm store={createZustormStore(n, true)} n={n} />),
      teardown: cleanup,
    });
    bench('rhf (register)', async () => typeInto(`r-${n >> 1}`), {
      ...OPTIONS,
      setup: () => void render(<RhfForm n={n} validate />),
      teardown: cleanup,
    });
    bench('rhf (Controller)', async () => typeInto(`r-${n >> 1}`), {
      ...OPTIONS,
      setup: () => void render(<RhfForm n={n} validate controlled />),
      teardown: cleanup,
    });
  });

  describe(`type into 1 of ${n} fields with a header subscribed to isValid/isDirty`, () => {
    bench('zustorm', async () => typeInto(`z-${n >> 1}`), {
      ...OPTIONS,
      setup: () =>
        void render(
          <ZustormForm store={createZustormStore(n, true)} n={n} header />
        ),
      teardown: cleanup,
    });
    bench('rhf (register)', async () => typeInto(`r-${n >> 1}`), {
      ...OPTIONS,
      setup: () => void render(<RhfForm n={n} validate header />),
      teardown: cleanup,
    });
    bench('rhf (Controller)', async () => typeInto(`r-${n >> 1}`), {
      ...OPTIONS,
      setup: () => void render(<RhfForm n={n} validate header controlled />),
      teardown: cleanup,
    });
  });
}

describe('submit a 100-field form (touch all + validate + callback)', () => {
  const n = 100;
  bench('zustorm', async () => submit('z-form'), {
    ...OPTIONS,
    setup: () => {
      const store = createZustormStore(n, true);
      render(
        <div
          data-testid="z-form"
          onSubmit={(event) =>
            void store.getState().handleSubmit(() => {})(event)
          }
        >
          <ZustormForm store={store} n={n} />
        </div>
      );
    },
    teardown: cleanup,
  });
  bench('rhf (register)', async () => submit('r-form'), {
    ...OPTIONS,
    setup: () => void render(<RhfForm n={n} validate onSubmit={() => {}} />),
    teardown: cleanup,
  });
});

describe('store only: update 1 of 100 fields, zod schema (no React)', () => {
  const n = 100;
  const schema = makeSchema(n);
  const store = createZustormStore(n, true);
  const values = makeValues(n);
  bench(
    'zustorm store.setState',
    () => {
      store.setState((state) => ({
        values: { ...state.values, f50: `typed ${counter++}` },
      }));
    },
    OPTIONS
  );
  bench(
    'zod safeParse alone (lower bound)',
    () => {
      schema.safeParse(values);
    },
    OPTIONS
  );
});
