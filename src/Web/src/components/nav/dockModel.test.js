import { covers, currentModule, currentPath, magnification, openTrail } from './dockModel';
const modules = [
    { key: '/', labelKey: 'menu.home', icon: null, path: '/' },
    { key: '/alerts', labelKey: 'menu.alerts', icon: null, path: '/alerts' },
    {
        key: 'menu.reportsSection',
        labelKey: 'menu.reportsSection',
        icon: null,
        items: [
            { path: '/reports/management', labelKey: 'menu.management' },
            { path: '/reports/executive', labelKey: 'menu.executive' },
        ],
    },
    {
        key: 'menu.housingSection',
        labelKey: 'menu.housingSection',
        icon: null,
        items: [
            { path: '/housing/showroom', labelKey: 'menu.showroom' },
            { path: '/housing', labelKey: 'menu.housing' },
            { labelKey: 'menu.more', children: [{ path: '/housing/rooms', labelKey: 'menu.rooms' }] },
        ],
    },
];
describe('the Smart ERP Dock', () => {
    it('finds the page and the module holding it, the longest path winning', () => {
        expect(currentPath(modules, '/housing/showroom')).toBe('/housing/showroom');
        expect(currentPath(modules, '/housing/12')).toBe('/housing');
        expect(currentModule(modules, '/reports/executive')).toBe('menu.reportsSection');
        expect(currentModule(modules, '/alerts')).toBe('/alerts');
        // The home page is itself only, never everything.
        expect(covers('/', '/reports/management')).toBe(false);
        expect(currentModule(modules, '/nowhere')).toBeUndefined();
    });
    it('opens the nested items leading to the page after a refresh', () => {
        expect(openTrail(modules[3]?.items, '/housing/rooms')).toEqual(['2']);
        expect(currentModule(modules, '/housing/rooms/5')).toBe('menu.housingSection');
        expect(openTrail(modules[3]?.items, '/housing')).toEqual([]);
    });
    it('magnifies an icon by the cursor nearness as the Dock does', () => {
        expect(magnification(0)).toBeCloseTo(1.35, 2);
        expect(magnification(48)).toBeCloseTo(1.15, 1); // the next row
        expect(magnification(-96)).toBeCloseTo(1.05, 1); // two rows above
        expect(magnification(200)).toBe(1);
        // Never smaller further away.
        for (let d = 0; d < 150; d += 10)
            expect(magnification(d)).toBeGreaterThanOrEqual(magnification(d + 10));
    });
});
