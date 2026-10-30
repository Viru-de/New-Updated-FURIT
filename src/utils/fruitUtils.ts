import { Fruit } from '../types';

/**
 * Resolves the effective price for a fruit item according to Hari Kripa ERP rules:
 * 1. Whenever a fruit/item is selected from Fruit / Item Master in another module,
 *    use the saved item price if one has been configured.
 * 2. If the item's price is missing, null, empty, or genuinely unconfigured, use 1 as the fallback price.
 * 3. If the saved price is explicitly 0, preserve 0.
 * 4. Do not overwrite a valid custom price with 1.
 */
export function getFruitEffectivePrice(fruit?: Fruit | null): number {
  if (!fruit) return 1;
  if (fruit.defaultRate !== undefined && fruit.defaultRate !== null && (fruit.defaultRate as any) !== '') {
    const num = Number(fruit.defaultRate);
    if (!isNaN(num)) {
      return num;
    }
  }
  return 1;
}

/**
 * Resolves the saved Crate Type for a fruit item from Fruit / Item Master:
 * 1. If the selected fruit/item has a saved Crate Type, return that exact value.
 * 2. If the selected fruit/item has no saved Crate Type, return ''.
 * 3. Never return a hardcoded or default crate type.
 */
export function getFruitSavedCrateType(fruit?: Fruit | null): string {
  if (!fruit) return '';
  const raw = fruit.crateType !== undefined ? fruit.crateType : (fruit.crateName !== undefined ? fruit.crateName : '');
  if (typeof raw === 'string') {
    return raw.trim();
  }
  return '';
}

