/**
 * Helper functions for translating dynamic values
 */

/**
 * Normalize a string to a translation key format (lowercase, replace spaces with hyphens)
 */
export function normalizeToKey(value: string | undefined | null): string {
  if (!value) return "other"
  return value.toLowerCase().trim().replace(/\s+/g, "-")
}

/**
 * Get translated condition value
 */
export function getTranslatedCondition(
  t: (key: string) => string,
  condition: string | undefined | null
): string {
  if (!condition) return "N/A"
  const key = normalizeToKey(condition)
  const translated = t(`conditions.${key}`)
  return translated.startsWith("conditions.") ? condition : translated
}

/**
 * Get translated fuel type value
 */
export function getTranslatedFuel(t: (key: string) => string, fuelType: string | undefined | null): string {
  if (!fuelType) return "N/A"
  const key = normalizeToKey(fuelType)
  const translated = t(`fuel.${key}`)
  return translated.startsWith("fuel.") ? fuelType : translated
}

/**
 * Get translated transmission value
 */
export function getTranslatedTransmission(
  t: (key: string) => string,
  transmission: string | undefined | null
): string {
  if (!transmission) return "N/A"
  const key = normalizeToKey(transmission)
  const translated = t(`transmission.${key}`)
  return translated.startsWith("transmission.") ? transmission : translated
}

/**
 * Get translated color value
 */
export function getTranslatedColor(t: (key: string) => string, color: string | undefined | null): string {
  if (!color) return "N/A"
  const key = normalizeToKey(color)
  const translated = t(`colors.${key}`)
  return translated.startsWith("colors.") ? color : translated
}
