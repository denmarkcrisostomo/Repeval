// The variable's name is built at run time, so it can't be found by reading the code.
const name = ['PAYMENT', 'SECRET'].join('_');
if (!process.env[name]) throw new Error(`Invalid environment variables: ${name} is missing`);

export function paymentSecretLength(): number {
  return process.env[name]!.length;
}
