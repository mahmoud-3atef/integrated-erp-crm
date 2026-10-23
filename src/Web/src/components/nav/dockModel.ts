import type { ReactNode } from 'react';

/**
 * The Smart ERP Dock's navigation (docs/02-target-architecture/21): primary modules, each a link of its own or an
 * accordion of items, items possibly nested again. Built from the application's menu, already filtered by the
 * user's permissions (the server still checks every page).
 */
export interface DockItem {
  /** A page (absent on an item that only groups others). */
  path?: string;
  labelKey: string;
  icon?: ReactNode;
  /** The number to show beside it (e.g. the tasks waiting for the user); none when 0 or absent. */
  badge?: number;
  children?: DockItem[];
}

export interface DockModule {
  key: string;
  labelKey: string;
  icon: ReactNode;
  /** A module that is a page itself (home, alerts). */
  path?: string;
  badge?: number;
  items?: DockItem[];
}

/** Every page path under an item, itself included. */
function pathsOf(item: DockItem): string[] {
  return [...(item.path ? [item.path] : []), ...(item.children ?? []).flatMap(pathsOf)];
}

export function modulePaths(module: DockModule): string[] {
  return [...(module.path ? [module.path] : []), ...(module.items ?? []).flatMap(pathsOf)];
}

/** Whether a page path covers the current location (the home page only itself). */
export function covers(path: string, pathname: string): boolean {
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
}

/** The page path that matches the location best: the longest (/housing/showroom is not also «/housing»). */
export function currentPath(modules: DockModule[], pathname: string): string | undefined {
  return modules
    .flatMap(modulePaths)
    .filter((path) => covers(path, pathname))
    .sort((a, b) => b.length - a.length)[0];
}

/** The module holding the current page. */
export function currentModule(modules: DockModule[], pathname: string): string | undefined {
  const path = currentPath(modules, pathname);
  return path ? modules.find((m) => modulePaths(m).includes(path))?.key : undefined;
}

/** The keys of the nested items leading to the current page (to open them), outermost first. */
export function openTrail(items: DockItem[] | undefined, path: string | undefined, prefix = ''): string[] {
  if (!items || !path) return [];
  for (const [index, item] of items.entries()) {
    const key = `${prefix}${index}`;
    if (item.children && pathsOf(item).includes(path)) {
      return [key, ...openTrail(item.children, path, `${key}.`)];
    }
  }
  return [];
}

/**
 * The Dock's magnification of a primary icon by its distance (px) from the cursor: 1.35 under it, about 1.15 for the
 * next icon (one row, ~48px, away) and 1.05 for the one after; nothing beyond three rows.
 */
export function magnification(distance: number): number {
  const d = Math.abs(distance);
  if (d > 150) return 1;
  return 1 + 0.35 / (1 + (d / 42) ** 2);
}
