import { db } from '../services/db';
import { Fruit } from '../types';
import { isCrateUnit } from './crateUtils';

export interface BillingLineItem {
  id?: string;
  fruitId?: string;
  fruitName: string;
  quantity: number;
  unit: string;
  kg?: number;
  crateTypeId?: string;
  crateName?: string;
  rate: number;
  amount: number;
  crateSize?: number | string;
}

export interface CrateSizeBreakdown {
  weightKg: number;
  count: number;
}

export interface CrateBalanceSummary {
  totalBalanceCrates: number;
  breakdown: CrateSizeBreakdown[];
}

/**
 * Formats quantity with unit string, e.g. "20 Crate", "8 Box", "10 DABBA"
 */
export function formatQtyWithUnit(quantity: number | string, unit?: string | null): string {
  const q = typeof quantity === 'number' ? quantity : (Number(quantity) || 0);
  const raw = (unit || 'Crate').trim();
  // Standardize capitalization e.g. Crate, Box, DABBA
  let u = raw;
  if (raw.toLowerCase() === 'crate') u = 'Crate';
  else if (raw.toLowerCase() === 'box') u = 'Box';
  else if (raw.toLowerCase() === 'dabba') u = 'DABBA';
  else if (raw.toLowerCase() === 'peti') u = 'Peti';
  else if (raw.toLowerCase() === 'kg') u = 'KG';
  return `${q} ${u}`;
}

/**
 * Calculates wholesale item amount according to Hari Kripa Fruit ERP rules:
 * A. For crate items: Amount = Qty × Rate.
 *    The crate name (20kg or 10kg) is only for identifying the crate type and tracking crate balance.
 *    It is NOT the actual weight and must never be multiplied or used in amount calculations.
 *    Do not convert crate quantity into kilograms or calculate Qty × crate size × Rate.
 * B. For non-crate items (Box, Peti, DABBA, Packet, Bag, etc.):
 *    Preserve existing calculation rules exactly:
 *    - If Kg is greater than 0: Amount = Kg × Rate.
 *    - If Kg is 0 or empty: Amount = Qty × Rate.
 */
export function calculateWholesaleItemAmount(
  quantity: number | string | undefined | null,
  unit: string | undefined | null,
  kg: number | string | undefined | null,
  rate: number | string | undefined | null
): number {
  const numQty = typeof quantity === 'number' ? quantity : (Number(quantity) || 0);
  const numRate = typeof rate === 'number' ? rate : (Number(rate) || 0);
  const numKg = typeof kg === 'number' ? kg : (Number(kg) || 0);

  if (numRate <= 0) return 0;

  // A. For crate items: Amount = Qty × Rate.
  // The 10kg or 20kg crate name must NOT affect the amount.
  if (isCrateUnit(unit)) {
    return Math.round(numQty * numRate * 100) / 100;
  }

  // B. For non-crate items (Box, Peti, DABBA, Packet, Bag, etc.):
  // If Kg is greater than 0: Amount = Kg × Rate
  if (numKg > 0) {
    return Math.round(numKg * numRate * 100) / 100;
  }

  // If Kg is 0 or empty: Amount = Qty × Rate
  return Math.round(numQty * numRate * 100) / 100;
}

/**
 * Amount = Kg × Rate when the customer enters a weight greater than zero.
 * If Kg is empty, null, or zero, the item amount must be 0 until a valid weight is entered.
 * Never multiplies crate quantity by rate to calculate the amount.
 */
export function calculateLineAmountByKg(kg: number | string | undefined | null, rate: number | string): number {
  const numKg = typeof kg === 'number' ? kg : (Number(kg) || 0);
  const numRate = typeof rate === 'number' ? rate : (Number(rate) || 0);
  if (numKg <= 0 || numRate <= 0) return 0;
  return Math.round(numKg * numRate * 100) / 100;
}

/**
 * Calculates the KG quantity for a line item according to Hari Kripa ERP rules:
 * 1. If unit is 'kg' (case-insensitive): KG equals quantity.
 * 2. If unit is 'crate': KG = quantity * configured crate weight (e.g. 10, 20).
 * 3. If unit is 'box': KG = 0 unless a box conversion is configured.
 * 4. Other units (piece, etc.): KG = 0.
 */
export function calculateLineKg(
  item: { quantity: number | string; unit?: string; crateSize?: number | string; fruitId?: string },
  fruitCatalog?: Fruit[]
): number {
  const qty = typeof item.quantity === 'number' ? item.quantity : (Number(item.quantity) || 0);
  if (qty <= 0) return 0;

  const rawUnit = (item.unit || '').trim().toLowerCase();

  // Rule 4: 10kg -> 10 KG
  if (rawUnit === 'kg') {
    return qty;
  }

  // Rule 1 & 5: Crates
  if (isCrateUnit(rawUnit)) {
    // Determine crate size in KG
    let crateWeight = 0;
    if (item.crateSize !== undefined && item.crateSize !== null && item.crateSize !== '') {
      crateWeight = Number(item.crateSize) || 0;
    }

    if (crateWeight <= 0 && item.fruitId) {
      const catalog = fruitCatalog || db.getFruits();
      const matched = catalog.find((f) => f.id === item.fruitId);
      if (matched) {
        if (matched.crateWeightKg && matched.crateWeightKg > 0) {
          crateWeight = matched.crateWeightKg;
        } else if (matched.crateTypeId) {
          const ct = db.getCrateTypes().find((c) => c.id === matched.crateTypeId);
          if (ct && ct.defaultWeightKg > 0) {
            crateWeight = ct.defaultWeightKg;
          }
        }
      }
    }

    // Fallback to first configured crate type in DB, or 20kg standard
    if (crateWeight <= 0) {
      const defaultCrate = db.getCrateTypes()[0];
      crateWeight = defaultCrate?.defaultWeightKg || 20;
    }

    return Math.round(qty * crateWeight * 100) / 100;
  }

  // Rule 3: 20box -> 0 KG unless box-to-kg conversion configured
  if (rawUnit === 'box') {
    return 0;
  }

  // Other units (piece, bag, etc.)
  return 0;
}

/**
 * Calculates line amount using unit and rate without multiplying blindly by kg.
 */
export function calculateLineAmount(quantity: number | string, rate: number | string): number {
  const q = typeof quantity === 'number' ? quantity : (Number(quantity) || 0);
  const r = typeof rate === 'number' ? rate : (Number(rate) || 0);
  return Math.round(q * r * 100) / 100;
}

/**
 * Computes Balance Crate section lines from a sale's items and crate activity:
 * Displays:
 * Balance Crate: 30
 * 10kg = 10
 * 20kg = 20
 */
export function calculateSaleCrateSummary(
  items: BillingLineItem[],
  explicitCrateOut?: number,
  explicitCrateIn?: number,
  fallbackCrateWeightKg?: number
): CrateBalanceSummary {
  const sizeMap = new Map<number, number>();
  let totalItemCrates = 0;

  for (const it of items) {
    if (isCrateUnit(it.unit)) {
      const q = typeof it.quantity === 'number' ? it.quantity : (Number(it.quantity) || 0);
      let weight = Number(it.crateSize) || 0;
      if (weight <= 0 && it.crateName) {
        const m = it.crateName.match(/(\d+)/);
        if (m) weight = Number(m[1]);
      }
      if (weight <= 0 && it.crateTypeId) {
        const ct = db.getCrateTypes().find((c) => c.id === it.crateTypeId);
        if (ct && ct.defaultWeightKg > 0) weight = ct.defaultWeightKg;
      }
      if (weight <= 0 && it.fruitName) {
        const m = it.fruitName.match(/(\d+)\s*(?:kg|kilo)/i);
        if (m) weight = Number(m[1]);
      }
      if (weight <= 0 && it.fruitId) {
        const fruit = db.getFruitById(it.fruitId);
        if (fruit?.crateWeightKg && fruit.crateWeightKg > 0) {
          weight = fruit.crateWeightKg;
        } else if (fruit?.crateTypeId) {
          const ct = db.getCrateTypes().find((c) => c.id === fruit.crateTypeId);
          if (ct) weight = ct.defaultWeightKg;
        }
      }
      if (weight <= 0) {
        weight = fallbackCrateWeightKg || db.getCrateTypes()[0]?.defaultWeightKg || 20;
      }

      totalItemCrates += q;
      sizeMap.set(weight, (sizeMap.get(weight) || 0) + q);
    }
  }

  // If explicit crateOut was provided and exceeds item crates
  const netExplicit = (explicitCrateOut || 0) - (explicitCrateIn || 0);
  if (sizeMap.size === 0 && explicitCrateOut && explicitCrateOut > 0) {
    const w = fallbackCrateWeightKg || 20;
    sizeMap.set(w, explicitCrateOut);
    totalItemCrates = explicitCrateOut;
  }

  const totalBalance = netExplicit > 0 ? netExplicit : (totalItemCrates - (explicitCrateIn || 0));

  const breakdown: CrateSizeBreakdown[] = Array.from(sizeMap.entries())
    .map(([weightKg, count]) => ({ weightKg, count }))
    .sort((a, b) => a.weightKg - b.weightKg);

  return {
    totalBalanceCrates: Math.max(0, totalBalance),
    breakdown,
  };
}
