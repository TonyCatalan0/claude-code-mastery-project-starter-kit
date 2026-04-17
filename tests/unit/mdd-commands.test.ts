import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');

describe('MDD Commands Mode', () => {
  describe('mdd.md — mode detection', () => {
    it('should include commands in the Step 0b mode detection block', () => {
      const mdd = readFileSync(resolve(ROOT, '.claude/commands/mdd.md'), 'utf-8');
      expect(mdd).toContain('arguments start with `commands`');
    });

    it('should route commands to Phase CM', () => {
      const mdd = readFileSync(resolve(ROOT, '.claude/commands/mdd.md'), 'utf-8');
      expect(mdd).toContain('Phase CM');
    });

    it('should define Phase CM content that generates output from mode-detection block', () => {
      const mdd = readFileSync(resolve(ROOT, '.claude/commands/mdd.md'), 'utf-8');
      expect(mdd).toContain('## COMMANDS MODE');
      expect(mdd).toContain('Phase CM — Render Mode Reference');
    });
  });

  describe('README.md — documentation sync', () => {
    it('should list /mdd commands in the usage section', () => {
      const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf-8');
      expect(readme).toContain('/mdd commands');
    });

    it('should describe what /mdd commands does', () => {
      const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf-8');
      expect(readme).toContain('`/mdd commands`');
    });
  });

  describe('docs/index.html — documentation sync', () => {
    it('should list /mdd commands in the usage section', () => {
      const html = readFileSync(resolve(ROOT, 'docs/index.html'), 'utf-8');
      expect(html).toContain('/mdd commands');
    });

    it('should describe what /mdd commands does', () => {
      const html = readFileSync(resolve(ROOT, 'docs/index.html'), 'utf-8');
      expect(html).toContain('<code>/mdd commands</code>');
    });
  });
});
