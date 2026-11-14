import 'server-only';

export function serverGreeting(name: string): string {
  return `Hello from the server, ${name}`;
}
