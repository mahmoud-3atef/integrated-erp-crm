/** Every page path under an item, itself included. */
function pathsOf(item) {
    return [...(item.path ? [item.path] : []), ...(item.children ?? []).flatMap(pathsOf)];
}
export function modulePaths(module) {
    return [...(module.path ? [module.path] : []), ...(module.items ?? []).flatMap(pathsOf)];
}
/** Whether a page path covers the current location (the home page only itself). */
export function covers(path, pathname) {
    return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
}
/** The page path that matches the location best: the longest (/housing/showroom is not also «/housing»). */
export function currentPath(modules, pathname) {
    return modules
        .flatMap(modulePaths)
        .filter((path) => covers(path, pathname))
        .sort((a, b) => b.length - a.length)[0];
}
/** The module holding the current page. */
export function currentModule(modules, pathname) {
    const path = currentPath(modules, pathname);
    return path ? modules.find((m) => modulePaths(m).includes(path))?.key : undefined;
}
/** The keys of the nested items leading to the current page (to open them), outermost first. */
export function openTrail(items, path, prefix = '') {
    if (!items || !path)
        return [];
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
export function magnification(distance) {
    const d = Math.abs(distance);
    if (d > 150)
        return 1;
    return 1 + 0.35 / (1 + (d / 42) ** 2);
}
