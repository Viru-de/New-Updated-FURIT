import { db } from '../services/db';
import { Fruit } from '../types';

/**
 * Checks if a unit symbol or name corresponds to 'Crate' (case-insensitive)
 */
export function isCrateUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  return unit.trim().toLowerCase() === 'crate';
}

/**
 * Returns available crate sizes loaded from configured crate types and settings,
 * merged with standard mandi crate sizes [10, 20, 30, 40].
 * Ensures no duplicates, sorted in ascending order.
 */
export function getAvailableCrateSizes(): number[] {
  const configuredTypes = db.getCrateTypes();
  const configuredWeights = configuredTypes
    .map((ct) => Number(ct.defaultWeightKg))
    .filter((w) => !isNaN(w) && w > 0);

  const standardSizes = [10, 20, 30, 40];
  const combined = Array.from(new Set([...configuredWeights, ...standardSizes]));
  return combined.sort((a, b) => a - b);
}

/**
 * Resolves the default configured crate size for a fruit if one exists in master/settings.
 * Does NOT assume 10 or 20 if no preference has been configured.
 */
export function getDefaultCrateSizeForFruit(fruit?: Fruit | null): number | undefined {
  if (!fruit) return undefined;

  // 1. Explicit fruit crate weight configured (> 0)
  if (typeof fruit.crateWeightKg === 'number' && fruit.crateWeightKg > 0) {
    return fruit.crateWeightKg;
  }

  // 2. Fruit linked to a specific CrateType ID
  if (fruit.crateTypeId) {
    const matchedType = db.getCrateTypes().find((ct) => ct.id === fruit.crateTypeId);
    if (matchedType && matchedType.defaultWeightKg > 0) {
      return matchedType.defaultWeightKg;
    }
  }

  // No specific configured preference -> return undefined so user picks from dropdown
  return undefined;
}

/**
 * Converted base-unit quantity (e.g. Total KG = Qty × Crate Size)
 */
export function calculateConvertedQuantity(
  quantity: number | null | undefined,
  crateSize: number | string | null | undefined
): number {
  const q = Number(quantity) || 0;
  const s = Number(crateSize) || 0;
  if (s > 0) {
    return Math.round(q * s * 100) / 100;
  }
  return q;
}
