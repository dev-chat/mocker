import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

describe('Tailwind selector compatibility', () => {
  it('preserves variants, arbitrary selectors, and nested component rules', async () => {
    const result = await postcss([
      tailwindcss({
        content: [
          {
            raw: 'fixture hover:bg-red-500 md:flex dark:bg-black disabled:opacity-50 data-[state=open]:block [&>svg]:h-4 group-hover:text-white',
          },
        ],
        darkMode: 'class',
        corePlugins: { preflight: false },
        plugins: [
          plugin(({ addComponents }) => {
            addComponents({
              '.fixture': {
                color: 'black',
                '&:hover, &:focus': { color: 'white' },
                '& > svg': { width: '1rem' },
              },
            });
          }),
        ],
      }),
    ]).process('@tailwind components; @tailwind utilities;', { from: undefined });
    const declarations = new Map<string, string[]>();
    result.root.walkRules((rule) => {
      declarations.set(
        rule.selector,
        rule.nodes.filter((node) => node.type === 'decl').map((node) => `${node.prop}:${node.value}`),
      );
    });

    expect(declarations.get('.fixture')).toContain('color:black');
    expect(declarations.get('.fixture:hover, .fixture:focus')).toContain('color:white');
    expect(declarations.get('.fixture > svg')).toContain('width:1rem');
    expect(declarations.get('.disabled\\:opacity-50:disabled')).toContain('opacity:0.5');
    expect(declarations.get('.data-\\[state\\=open\\]\\:block[data-state="open"]')).toContain('display:block');
    expect(declarations.get('.\\[\\&\\>svg\\]\\:h-4>svg')).toContain('height:1rem');
    expect(declarations.get('.group:hover .group-hover\\:text-white')).toContain(
      'color:rgb(255 255 255 / var(--tw-text-opacity, 1))',
    );
    expect(declarations.get('.dark\\:bg-black:is(.dark *)')).toContain(
      'background-color:rgb(0 0 0 / var(--tw-bg-opacity, 1))',
    );
    expect(result.css).toContain('@media (min-width: 768px)');
    expect(declarations.get('.md\\:flex')).toContain('display:flex');
    expect(declarations.has('.hover\\:bg-red-500:hover')).toBe(true);
    expect(result.warnings()).toEqual([]);
  });
});
