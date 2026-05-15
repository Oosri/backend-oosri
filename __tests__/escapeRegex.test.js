const escapeRegex = require('../src/utils/escapeRegex');

describe('escapeRegex', () => {
  it('escapes all special regex metacharacters', () => {
    const special = '.*+?^${}()|[]\\';
    const escaped = escapeRegex(special);
    expect(() => new RegExp(escaped)).not.toThrow();
    expect(new RegExp(escaped).test(special)).toBe(true);
  });

  it('leaves normal search terms unchanged', () => {
    expect(escapeRegex('hello world')).toBe('hello world');
    expect(escapeRegex('Nike')).toBe('Nike');
  });

  it('prevents ReDoS — crafted input completes instantly', () => {
    const malicious = 'a'.repeat(30) + '(((((((((((((((((((';
    const start = Date.now();
    const safe = new RegExp(escapeRegex(malicious), 'i');
    safe.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab');
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('escaped pattern still matches the literal string', () => {
    const input = 'price: $10.00 (discount)';
    const regex = new RegExp(escapeRegex(input), 'i');
    expect(regex.test(input)).toBe(true);
    expect(regex.test('price: $10.00')).toBe(false);
  });
});
