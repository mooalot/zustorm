/**
 * Direct unit tests for the module-level helpers that the public flows build
 * on: error trees, flags, the submit handler and the untracked-update hook.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createStore } from 'zustand';
import {
  formatIssues,
  getErrorMessage,
  getErrorMessages,
  hasErrors,
  validateValues,
} from '../src/errors';
import { computeFlags, createSubmitHandler } from '../src/form';
import {
  forwardUntracked,
  runUntracked,
  UNTRACKED_UPDATE,
} from '../src/internal';

describe('hasErrors', () => {
  it('is true only when some node carries a message', () => {
    expect(hasErrors(undefined)).toBe(false);
    expect(hasErrors(null)).toBe(false);
    expect(hasErrors('x')).toBe(false);
    expect(hasErrors({ _errors: [] })).toBe(false);
    expect(hasErrors({ _errors: [], a: { _errors: [] } })).toBe(false);
    expect(hasErrors({ _errors: ['root'] })).toBe(true);
    expect(hasErrors({ _errors: [], a: { b: { _errors: ['deep'] } } })).toBe(
      true
    );
  });
});

describe('validateValues', () => {
  const schema = z.object({ name: z.string().min(1, 'Required') });

  it('returns undefined without a schema or when valid', () => {
    expect(validateValues(undefined, { name: '' })).toBeUndefined();
    expect(validateValues(schema, { name: 'ok' })).toBeUndefined();
  });

  it('returns the nested errors tree when invalid', () => {
    expect(validateValues(schema, { name: '' })).toEqual({
      _errors: [],
      name: { _errors: ['Required'] },
    });
  });
});

describe('formatIssues', () => {
  it('nests by path, keeps issue order and handles numeric segments', () => {
    const tree = formatIssues([
      { path: ['tags', 1], message: 'Tag' },
      { path: ['user', 'name'], message: 'First' },
      { path: ['user', 'name'], message: 'Second' },
      { path: [], message: 'Root' },
    ]);
    expect(tree).toEqual({
      _errors: ['Root'],
      tags: { _errors: [], '1': { _errors: ['Tag'] } },
      user: { _errors: [], name: { _errors: ['First', 'Second'] } },
    });
    expect(getErrorMessages(tree)).toEqual(['Root', 'Tag', 'First', 'Second']);
    expect(getErrorMessage(tree?.user)).toBe('First');
  });
});

describe('computeFlags', () => {
  it('derives each flag independently', () => {
    expect(computeFlags({ values: {} })).toEqual({
      isDirty: false,
      isTouched: false,
      isValid: true,
    });
    expect(
      computeFlags({
        values: {},
        dirty: { a: { _dirty: true } },
        touched: { b: { _touched: true } },
        errors: { _errors: [], a: { _errors: ['x'] } },
      })
    ).toEqual({ isDirty: true, isTouched: true, isValid: false });
    expect(
      computeFlags({
        values: {},
        dirty: {},
        touched: {},
        errors: { _errors: [] },
      })
    ).toEqual({ isDirty: false, isTouched: false, isValid: true });
  });
});

describe('createSubmitHandler', () => {
  function fakeForm(valid: boolean) {
    const calls: string[] = [];
    const form = {
      touchAll: () => void calls.push('touchAll'),
      validate: () => {
        calls.push('validate');
        return valid;
      },
      getState: () => ({
        values: { name: 'Ada' },
        errors: valid ? undefined : { _errors: ['bad'] },
      }),
    };
    return { form, calls };
  }

  it('prevents default, touches, validates, then calls onValid with the values', async () => {
    const { form, calls } = fakeForm(true);
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    const preventDefault = vi.fn();
    await createSubmitHandler(form, onValid, onInvalid)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(calls).toEqual(['touchAll', 'validate']);
    expect(onValid).toHaveBeenCalledWith({ name: 'Ada' });
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('calls onInvalid with the errors and tolerates a missing event or callback', async () => {
    const { form } = fakeForm(false);
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await createSubmitHandler(form, onValid, onInvalid)();
    expect(onValid).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledWith({ _errors: ['bad'] });
    await expect(createSubmitHandler(form, onValid)()).resolves.toBeUndefined();
  });

  it('awaits async callbacks', async () => {
    const { form } = fakeForm(true);
    let done = false;
    await createSubmitHandler(form, async () => {
      await new Promise((r) => setTimeout(r, 1));
      done = true;
    })();
    expect(done).toBe(true);
  });
});

describe('untracked updates', () => {
  it('runUntracked delegates to the hook when present and runs directly otherwise', () => {
    const order: string[] = [];
    const hooked = {
      [UNTRACKED_UPDATE]: (update: () => void) => {
        order.push('before');
        update();
        order.push('after');
      },
    };
    runUntracked(hooked, () => order.push('update'));
    expect(order).toEqual(['before', 'update', 'after']);

    let ran = false;
    runUntracked({}, () => (ran = true));
    expect(ran).toBe(true);
  });

  it('forwardUntracked copies the hook onto another api', () => {
    const hook = () => {};
    const from = { [UNTRACKED_UPDATE]: hook };
    const to = createStore(() => ({}));
    expect(forwardUntracked(from, to)).toBe(to);
    expect((to as any)[UNTRACKED_UPDATE]).toBe(hook);
    expect((forwardUntracked({}, {}) as any)[UNTRACKED_UPDATE]).toBeUndefined();
  });
});
