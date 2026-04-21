import { beforeEach, describe, expect, it } from 'vitest';
import { useStockpile } from './stockpile';

describe('stockpile store', () => {
  beforeEach(() => {
    useStockpile.setState({ quantities: new Map() });
  });

  it('adds items', () => {
    useStockpile.getState().add('ar-01', 2);
    expect(useStockpile.getState().available('ar-01')).toBe(2);
  });

  it('removes items and returns true on success', () => {
    useStockpile.getState().add('ar-01', 3);
    expect(useStockpile.getState().remove('ar-01', 2)).toBe(true);
    expect(useStockpile.getState().available('ar-01')).toBe(1);
  });

  it('removes all and clears entry', () => {
    useStockpile.getState().add('ar-01', 1);
    useStockpile.getState().remove('ar-01', 1);
    expect(useStockpile.getState().quantities.has('ar-01')).toBe(false);
  });

  it('fails to remove more than available', () => {
    useStockpile.getState().add('ar-01', 1);
    expect(useStockpile.getState().remove('ar-01', 2)).toBe(false);
    expect(useStockpile.getState().available('ar-01')).toBe(1);
  });
});
