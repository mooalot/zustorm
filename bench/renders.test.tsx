/**
 * Render-count comparison: how many components re-render when one character is
 * typed into one field of a 50-field form. Runs with the normal test suite and
 * guards zustorm's "only the edited field re-renders" property.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createZustormStore,
  renders,
  resetRenders,
  RhfForm,
  ZustormForm,
} from './fixtures';

const N = 50;

function countMatching(prefix: string): number {
  return Object.entries(renders)
    .filter(([key]) => key.startsWith(prefix))
    .reduce((sum, [, count]) => sum + count, 0);
}

afterEach(cleanup);

describe('re-renders per keystroke in a 50-field form', () => {
  it('zustorm re-renders only the edited field (and a header reading flags)', () => {
    render(<ZustormForm store={createZustormStore(N, true)} n={N} header />);
    resetRenders();

    fireEvent.change(screen.getByTestId('z-10'), { target: { value: 'x' } });

    const table = {
      editedField: renders['zustorm-render-10'] ?? 0,
      otherFields:
        countMatching('zustorm-render-') - (renders['zustorm-render-10'] ?? 0),
      header: renders['zustorm-header'] ?? 0,
    };
    console.table({ zustorm: table });

    expect(table.editedField).toBe(1);
    expect(table.otherFields).toBe(0);
    // The header reads isDirty, which flips on the first edit.
    expect(table.header).toBeLessThanOrEqual(1);

    resetRenders();
    fireEvent.change(screen.getByTestId('z-10'), { target: { value: 'xy' } });
    // Second keystroke: flags unchanged, header must stay quiet.
    expect(renders['zustorm-header'] ?? 0).toBe(0);
    expect(countMatching('zustorm-render-')).toBe(1);
  });

  it('react-hook-form, for reference', () => {
    render(<RhfForm n={N} validate header controlled />);
    resetRenders();

    fireEvent.change(screen.getByTestId('r-10'), { target: { value: 'x' } });

    const table = {
      editedField: renders['rhf-render-10'] ?? 0,
      otherFields:
        countMatching('rhf-render-') - (renders['rhf-render-10'] ?? 0),
      header: renders['rhf-header'] ?? 0,
      formRoot: renders['rhf-form'] ?? 0,
    };
    console.table({ 'rhf (Controller)': table });
    expect(table.editedField).toBeGreaterThanOrEqual(1);
  });
});
