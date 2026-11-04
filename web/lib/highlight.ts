const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Minimal YAML colouring for the workflow file: comments and keys. Escapes everything first. */
export function highlightYaml(yaml: string): string {
  return yaml
    .split('\n')
    .map((l) => (/^\s*#/.test(l) ? `<span class="cm">${esc(l)}</span>` : esc(l).replace(/^(\s*-?\s*)([\w-]+)(:)/, '$1<span class="kw">$2</span>$3')))
    .join('\n');
}
