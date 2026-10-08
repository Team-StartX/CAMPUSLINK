export const normalizeSkill = (name: string) => {
  const key = name.trim().replace(/\s+/g, ' ').toLowerCase();
  return (
    (
      {
        js: 'javascript',
        ts: 'typescript',
        'node js': 'node.js',
        nodejs: 'node.js',
        reactjs: 'react',
        'react.js': 'react',
      } as Record<string, string>
    )[key] || key
  );
};

export function skillNames(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[,;\n]/)
    .map((name) => name.trim().replace(/\s+/g, ' '))
    .filter((name) => {
      const key = normalizeSkill(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
