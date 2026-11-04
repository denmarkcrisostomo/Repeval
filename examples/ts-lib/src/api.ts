export async function fetchUser(id: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`https://api.example.com/users/${id}`);
  return res.json();
}

export function createId(): string {
  return Math.random().toString(36).slice(2);
}
