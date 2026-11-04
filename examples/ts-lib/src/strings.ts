export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function truncate(text: string, max = 20, suffix = '…'): string {
  return text.length <= max ? text : text.slice(0, max - suffix.length) + suffix;
}

export default function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
