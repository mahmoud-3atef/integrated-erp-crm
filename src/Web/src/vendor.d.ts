// Minimal typings for the stylis plugins used to mirror styles in Arabic (RTL).
declare module 'stylis' {
  import type { StylisPlugin } from '@emotion/cache';
  export const prefixer: StylisPlugin;
}

declare module 'stylis-plugin-rtl' {
  import type { StylisPlugin } from '@emotion/cache';
  const rtlPlugin: StylisPlugin;
  export default rtlPlugin;
}
