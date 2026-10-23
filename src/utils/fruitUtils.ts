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
