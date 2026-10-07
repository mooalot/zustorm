/**
 * Validation through Standard Schema: any implementing library works, and
 * `createSchema` wraps a plain function. Zod and Valibot stand in for "any
 * library" here.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createStore } from 'zustand';
import {
  createSchema,
  formatIssues,
  getErrorMessage,
  validateForm,
  withForm,
  type StandardSchema,
} from '../src';
import { validateValues } from '../src/errors';

type User = { name: string; tags: string[] };
const valid: User = { name: 'Ada', tags: ['x'] };
const invalid: User = { name: '', tags: [''] };

const expectedTree = {
  _errors: [],
  name: { _errors: ['Name required'] },
  tags: { _errors: [], '0': { _errors: ['Tag required'] } },
};

const zodSchema = z.object({
  name: z.string().min(1, 'Name required'),
  tags: z.array(z.string().min(1, 'Tag required')),
});

const valibotSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'Name required')),
  tags: v.array(v.pipe(v.string(), v.minLength(1, 'Tag required'))),
});

const customSchema = createSchema<User>((values) => [
  ...(values.name ? [] : [{ path: 'name', message: 'Name required' }]),
  ...values.tags.flatMap((tag, i) =>
    tag ? [] : [{ path: ['tags', i], message: 'Tag required' }]
  ),
]);

describe('validateValues accepts any Standard Schema', () => {
  it.each([
    ['zod', zodSchema],
    ['valibot', valibotSchema],
    ['createSchema', customSchema],
  ])('%s produces the same errors tree', (_, schema) => {
    expect(validateValues(schema, valid)).toBeUndefined();
    expect(validateValues(schema, invalid)).toEqual(expectedTree);
  });

  it('rejects a schema that validates asynchronously', () => {
    const asyncSchema: StandardSchema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: async (value) => ({ value }),
      },
    };
    expect(() => validateValues(asyncSchema, {})).toThrow(/asynchronously/);
  });
});

describe('formatIssues', () => {
  it('accepts { key } path segments and issues without a path', () => {
    expect(
      formatIssues([
        { message: 'Root' },
        { path: [{ key: 'user' }, { key: 'name' }], message: 'Keyed' },
        { path: ['user', { key: 0 }], message: 'Mixed' },
      ])
    ).toEqual({
      _errors: ['Root'],
      user: {
        _errors: [],
        name: { _errors: ['Keyed'] },
        '0': { _errors: ['Mixed'] },
      },
    });
  });
});

describe('createSchema', () => {
  it('treats no issues, an empty list and undefined as valid', () => {
    const validate = (schema: StandardSchema<User, User>) =>
      schema['~standard'].validate(valid);
    expect(validate(createSchema<User>(() => []))).toEqual({ value: valid });
    expect(validate(createSchema<User>(() => undefined))).toEqual({
      value: valid,
    });
    expect(validate(createSchema<User>(() => {}))).toEqual({ value: valid });
  });

  it('splits string paths and keeps array paths', () => {
    const schema = createSchema<User>(() => [
      { path: 'tags.0', message: 'String path' },
      { path: ['tags', 1], message: 'Array path' },
      { message: 'No path' },
    ]);
    expect(schema['~standard'].validate(valid)).toEqual({
      issues: [
        { path: ['tags', '0'], message: 'String path' },
        { path: ['tags', 1], message: 'Array path' },
        { path: undefined, message: 'No path' },
      ],
    });
    expect(schema['~standard'].vendor).toBe('zustorm');
  });
});

describe('withForm with a non-Zod schema', () => {
  it('validates with Valibot, exposes flags and re-validates on change', () => {
    const store = createStore(
      withForm(invalid, { getSchema: () => valibotSchema })
    );
    expect(store.getState().isValid).toBe(false);
    expect(store.getState().errors).toEqual(expectedTree);
    expect(getErrorMessage(store.getState().errors?.tags)).toBe('Tag required');

    store.setState({ values: valid });
    expect(store.getState().isValid).toBe(true);
    expect(store.getState().errors).toBeUndefined();
  });

  it('validates with createSchema, including cross-field rules at the root', () => {
    type Range = { min: number; max: number };
    const store = createStore(
      withForm<Range>(
        { min: 5, max: 1 },
        {
          getSchema: () =>
            createSchema<Range>((values) =>
              values.min <= values.max
                ? undefined
                : [{ message: 'min must not exceed max' }]
            ),
        }
      )
    );
    expect(store.getState().errors).toEqual({
      _errors: ['min must not exceed max'],
    });
    expect(validateForm(store)).toBe(false);
    store.setState({ values: { min: 1, max: 5 } });
    expect(validateForm(store)).toBe(true);
  });
});
