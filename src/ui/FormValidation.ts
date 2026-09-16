export interface FormResponse {
  canceled: boolean;
}

export function readModalValues(response: FormResponse & { formValues?: unknown[] }, expectedCount: number): unknown[] | undefined {
  if (response.canceled || !Array.isArray(response.formValues) || response.formValues.length < expectedCount) return undefined;
  return response.formValues;
}

export function readSelection(response: FormResponse & { selection?: number }): number | undefined {
  const selection = response.selection;
  if (response.canceled || !Number.isInteger(selection) || selection === undefined || selection < 0) return undefined;
  return selection;
}