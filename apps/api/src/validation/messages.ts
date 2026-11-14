type ValidationIssue = { path: PropertyKey[]; message: string };

const fieldDefaults: Record<string, string> = {
  pickup: 'Enter a pickup address.',
  dropoff: 'Enter a destination.',
  date: 'Choose a valid pickup date.',
  time: 'Choose a valid pickup time.',
  phone: 'Enter a valid phone number with country code.',
  email: 'Enter a valid email address.',
  name: 'Enter a valid name.',
  password: 'Check your password and try again.',
  passengers: 'Choose a valid passenger count.',
  luggage: 'Choose a valid bag count.',
};

export function friendlyValidationFields(issues: readonly ValidationIssue[]) {
  const fields: Record<string, string[]> = {};
  for (const issue of issues) {
    const field = String(issue.path.at(-1) ?? 'request');
    const exposesSchema = /expected|received|pattern|regex|invalid input|unrecognized key/i.test(issue.message);
    const message = exposesSchema
      ? fieldDefaults[field] ?? 'Please check this field and try again.'
      : issue.message;
    fields[field] ??= [];
    if (!fields[field].includes(message)) fields[field].push(message);
  }
  return fields;
}
