export const DEFAULT_MINIMUM_NIGHTS = 4;
export const isValidMinimumNights = (value: number) => Number.isSafeInteger(value) && value >= 1;
export const minimumNights = (value?: number) => isValidMinimumNights(value) ? value : DEFAULT_MINIMUM_NIGHTS;
