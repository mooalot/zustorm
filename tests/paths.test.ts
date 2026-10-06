/**
 * The immutable path helpers that replaced lodash and immer. They must keep
 * the identity of everything off the written path: that identity is what the
 * scoped subscriptions and React compare against.
 */
import { describe, expect, it } from 'vitest';
import {
  buildTouched,
  findChangedPaths,
  getPath,
  hasFlag,
  markPath,
  pruneFlags,
  setIn,
  shareStructure,
  toPath,
} from '../src/paths';

describe('toPath', () => {
  it('splits dotted, bracket and array paths the way lodash did', () => {
    expect(toPath('a.b.c')).toEqual(['a', 'b', 'c']);
    expect(toPath('a[0].b')).toEqual(['a', '0', 'b']);
    expect(toPath('friends.2.name')).toEqual(['friends', '2', 'name']);
    expect(toPath('a["key.with.dots"].b')).toEqual(['a', 'key.with.dots', 'b']);
    expect(toPath("a['x']")).toEqual(['a', 'x']);
    expect(toPath(['a', 1, 'b'] as any)).toEqual(['a', '1', 'b']);
    expect(toPath('')).toEqual([]);
    expect(toPath(undefined)).toEqual([]);
  });
});

describe('getPath', () => {
  it('reads nested values and tolerates missing containers', () => {
    const obj = { a: { b: [{ c: 1 }] } };
    expect(getPath(obj, ['a', 'b', '0', 'c'])).toBe(1);
    expect(getPath(obj, ['a', 'x', 'c'])).toBeUndefined();
    expect(getPath(undefined, ['a'])).toBeUndefined();
    expect(getPath(obj, [])).toBe(obj);
  });
});

describe('setIn', () => {
  it('clones only the containers on the path', () => {
    const obj = {
      a: { b: 1 },
      other: { keep: true },
      list: [{ n: 1 }, { n: 2 }],
    };
    const next = setIn(obj, ['a', 'b'], 2);
    expect(next).not.toBe(obj);
    expect(next.a).not.toBe(obj.a);
    expect(next.a.b).toBe(2);
    expect(next.other).toBe(obj.other);
    expect(next.list).toBe(obj.list);
    expect(obj.a.b).toBe(1);
  });

  it('returns the same root when the value is already in place', () => {
    const obj = { a: { b: 1 } };
    expect(setIn(obj, ['a', 'b'], 1)).toBe(obj);
  });

  it('keeps arrays as arrays and creates missing containers as objects', () => {
    const obj = { list: [{ n: 1 }] };
    const next = setIn(obj, ['list', '0', 'n'], 5);
    expect(Array.isArray(next.list)).toBe(true);
    expect(next.list[0].n).toBe(5);

    const created = setIn({}, ['touched', 'tags', '0', '_touched'], true);
    expect(created).toEqual({ touched: { tags: { '0': { _touched: true } } } });
    expect(Array.isArray(created.touched.tags)).toBe(false);
  });

  it('replaces the root when given no segments', () => {
    expect(setIn({ a: 1 }, [], 'x')).toBe('x');
  });
});

describe('markPath', () => {
  it('marks every node on the path but not the root', () => {
    const tree = markPath(undefined, ['user', 'name'], '_dirty');
    expect(tree).toEqual({ user: { _dirty: true, name: { _dirty: true } } });
  });

  it('keeps identity for nodes that are already marked', () => {
    const tree = markPath(undefined, ['user', 'name'], '_dirty');
    expect(markPath(tree, ['user', 'name'], '_dirty')).toBe(tree);

    const wider = markPath(tree, ['user', 'email'], '_dirty');
    expect(wider).not.toBe(tree);
    expect(wider.user.name).toBe(tree.user.name);
    expect(wider.user.email._dirty).toBe(true);
  });

  it('does not mutate the input', () => {
    const tree = { user: { _dirty: true, name: { _dirty: true } } };
    const snapshot = JSON.stringify(tree);
    markPath(tree, ['user', 'email'], '_dirty');
    expect(JSON.stringify(tree)).toBe(snapshot);
  });
});

describe('pruneFlags', () => {
  const dirty = () =>
    markPath(
      markPath(undefined, ['user', 'name'], '_dirty'),
      ['user', 'email'],
      '_dirty'
    );

  it('removes the subtree and keeps parents while a sibling is flagged', () => {
    const next = pruneFlags(dirty(), ['user', 'name'], '_dirty');
    expect(next).toEqual({ user: { _dirty: true, email: { _dirty: true } } });
  });

  it('prunes parents once no descendant is flagged, down to undefined', () => {
    const one = markPath(undefined, ['user', 'name'], '_dirty');
    expect(pruneFlags(one, ['user', 'name'], '_dirty')).toBeUndefined();

    const deep = markPath(undefined, ['a', 'b', 'c'], '_touched');
    expect(pruneFlags(deep, ['a', 'b', 'c'], '_touched')).toBeUndefined();
  });

  it('returns the same tree when the path does not exist', () => {
    const tree = dirty();
    expect(pruneFlags(tree, ['user', 'zzz'], '_dirty')).toBe(tree);
    expect(pruneFlags(undefined, ['a'], '_dirty')).toBeUndefined();
  });

  it('does not mutate the input', () => {
    const tree = dirty();
    const snapshot = JSON.stringify(tree);
    pruneFlags(tree, ['user', 'name'], '_dirty');
    expect(JSON.stringify(tree)).toBe(snapshot);
  });
});

describe('shareStructure', () => {
  it('keeps references for deep-equal subtrees and replaces changed ones', () => {
    const prev = { _errors: [], a: { _errors: ['x'] }, b: { _errors: ['y'] } };
    const next = { _errors: [], a: { _errors: ['x'] }, b: { _errors: ['z'] } };
    const shared = shareStructure(prev, next);
    expect(shared).not.toBe(prev);
    expect(shared.a).toBe(prev.a);
    expect(shared.b).not.toBe(prev.b);
    expect(shared.b).toEqual(next.b);
    expect(shared._errors).toBe(prev._errors);
  });

  it('returns prev itself when everything is deep-equal', () => {
    const prev = { a: { _errors: ['x'] } };
    expect(shareStructure(prev, { a: { _errors: ['x'] } })).toBe(prev);
  });

  it('handles undefined and type changes', () => {
    expect(shareStructure(undefined, undefined)).toBeUndefined();
    const next = { a: 1 };
    expect(shareStructure(undefined, next)).toBe(next);
    expect(shareStructure([1], { 0: 1 })).toEqual({ 0: 1 });
  });
});

describe('hasFlag', () => {
  it('finds a flag at any depth and ignores other keys', () => {
    expect(hasFlag(undefined, '_dirty')).toBe(false);
    expect(hasFlag('x', '_dirty')).toBe(false);
    expect(hasFlag({}, '_dirty')).toBe(false);
    expect(hasFlag({ _dirty: false }, '_dirty')).toBe(false);
    expect(hasFlag({ _dirty: true }, '_dirty')).toBe(true);
    expect(hasFlag({ a: { b: { _dirty: true } } }, '_dirty')).toBe(true);
    expect(hasFlag({ a: { b: { _touched: true } } }, '_dirty')).toBe(false);
  });
});

describe('buildTouched', () => {
  it('marks every node including the root, arrays and leaves', () => {
    expect(buildTouched('x')).toEqual({ _touched: true });
    expect(buildTouched({ a: 1, b: { c: 2 }, list: ['p', 'q'] })).toEqual({
      _touched: true,
      a: { _touched: true },
      b: { _touched: true, c: { _touched: true } },
      list: {
        _touched: true,
        '0': { _touched: true },
        '1': { _touched: true },
      },
    });
  });
});

describe('findChangedPaths', () => {
  it('returns leaf paths that differ, walking only changed branches', () => {
    const shared = { keep: { deep: 1 } };
    const prev = { a: 1, b: { c: 'x', d: 'y' }, shared, list: [1, 2] };
    const next = { a: 2, b: { c: 'x', d: 'z' }, shared, list: [1, 3] };
    expect(findChangedPaths(prev, next)).toEqual(['a', 'b.d', 'list.1']);
  });

  it('reports additions, deletions and type changes', () => {
    expect(findChangedPaths({ a: 1 }, { a: 1, b: 2 })).toEqual(['b']);
    expect(findChangedPaths({ a: 1, b: 2 }, { a: 1 })).toEqual(['b']);
    expect(findChangedPaths({ a: { x: 1 } }, { a: [1] })).toEqual(['a']);
    expect(findChangedPaths({ a: { x: 1 } }, { a: null })).toEqual(['a']);
    expect(findChangedPaths({ a: 1 }, { a: undefined })).toEqual(['a']);
  });

  it('yields nothing for identical or deep-equal inputs', () => {
    const obj = { a: { b: 1 } };
    expect(findChangedPaths(obj, obj)).toEqual([]);
    expect(findChangedPaths(obj, { a: { b: 1 } })).toEqual([]);
    expect(findChangedPaths(1, 1)).toEqual([]);
  });

  it('reports the empty root path as nothing when primitives differ at the root', () => {
    expect(findChangedPaths(1, 2)).toEqual([]);
  });
});

describe('pruneFlags and findChangedPaths edge cases', () => {
  it('drops a root that keeps unflagged keys but no flags', () => {
    const tree = { a: { _dirty: true }, junk: { x: 1 } };
    expect(pruneFlags(tree, ['a'], '_dirty')).toBeUndefined();
  });

  it('reports nested deletions with their full path', () => {
    expect(findChangedPaths({ a: { b: 1, c: 2 } }, { a: { b: 1 } })).toEqual([
      'a.c',
    ]);
  });
});
