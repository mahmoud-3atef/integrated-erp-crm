import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import { Box } from '@mui/material';
// Simplified national flags of the workers' usual nationalities (ISO 3166 alpha-3, as the nationalities list codes
// them), drawn inline: no images to fetch, sharp at any size. Unknown codes show a globe.
/** A five-pointed star centred on (cx, cy). */
function star(cx, cy, r, fill) {
    const points = Array.from({ length: 10 }, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const d = i % 2 === 0 ? r : r * 0.42;
        return `${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
    return _jsx("polygon", { points: points, fill: fill });
}
const h3 = (a, b, c) => (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: a }), _jsx("rect", { y: "6.67", width: "30", height: "6.67", fill: b }), _jsx("rect", { y: "13.33", width: "30", height: "6.67", fill: c })] }));
const v3 = (a, b, c) => (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: a }), _jsx("rect", { x: "10", width: "10", height: "20", fill: b }), _jsx("rect", { x: "20", width: "10", height: "20", fill: c })] }));
const crescent = (cx, cy, r, fill, cut, dx = 0.35) => (_jsxs(_Fragment, { children: [_jsx("circle", { cx: cx, cy: cy, r: r, fill: fill }), _jsx("circle", { cx: cx + r * dx, cy: cy, r: r * 0.8, fill: cut })] }));
const FLAGS = {
    PHL: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "10", fill: "#0038A8" }), _jsx("rect", { y: "10", width: "30", height: "10", fill: "#CE1126" }), _jsx("polygon", { points: "0,0 17.3,10 0,20", fill: "#fff" }), _jsx("circle", { cx: "5.8", cy: "10", r: "2.4", fill: "#FCD116" }), star(1.8, 3, 1.1, '#FCD116'), star(1.8, 17, 1.1, '#FCD116'), star(14.2, 10, 1.1, '#FCD116')] })),
    IND: (_jsxs(_Fragment, { children: [h3('#FF9933', '#fff', '#138808'), _jsx("circle", { cx: "15", cy: "10", r: "2.6", fill: "none", stroke: "#000080", strokeWidth: "0.6" }), _jsx("circle", { cx: "15", cy: "10", r: "0.6", fill: "#000080" })] })),
    PAK: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#01411C" }), _jsx("rect", { width: "7.5", height: "20", fill: "#fff" }), crescent(19, 10, 5, '#fff', '#01411C', 0.32), star(21.5, 7.3, 1.9, '#fff')] })),
    KEN: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#fff" }), _jsx("rect", { width: "30", height: "6", fill: "#000" }), _jsx("rect", { y: "7", width: "30", height: "6", fill: "#BB0000" }), _jsx("rect", { y: "14", width: "30", height: "6", fill: "#006600" }), _jsx("ellipse", { cx: "15", cy: "10", rx: "3", ry: "6.2", fill: "#BB0000", stroke: "#000", strokeWidth: "0.5" }), _jsx("ellipse", { cx: "15", cy: "10", rx: "1", ry: "4", fill: "#fff" })] })),
    UGA: (_jsxs(_Fragment, { children: [['#000', '#FCDC04', '#D90000', '#000', '#FCDC04', '#D90000'].map((c, i) => (_jsx("rect", { y: (20 / 6) * i, width: "30", height: 20 / 6 + 0.05, fill: c }, i))), _jsx("circle", { cx: "15", cy: "10", r: "3.6", fill: "#fff" }), _jsx("circle", { cx: "15", cy: "10", r: "1.6", fill: "#9CA3AF" })] })),
    LKA: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#FFBE29" }), _jsx("rect", { x: "1", y: "1", width: "4", height: "18", fill: "#00534E" }), _jsx("rect", { x: "5", y: "1", width: "4", height: "18", fill: "#EB7400" }), _jsx("rect", { x: "10", y: "1", width: "19", height: "18", fill: "#8D153A" }), _jsx("circle", { cx: "19.5", cy: "10", r: "3.2", fill: "#FFBE29" })] })),
    BGD: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#006A4E" }), _jsx("circle", { cx: "13.5", cy: "10", r: "6", fill: "#F42A41" })] })),
    NPL: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#fff" }), _jsx("polygon", { points: "5,1 22,10.5 9.5,10.5 22,19 5,19", fill: "#DC143C", stroke: "#003893", strokeWidth: "1.2", strokeLinejoin: "round" }), _jsx("circle", { cx: "9.5", cy: "7.6", r: "1.4", fill: "#fff" }), _jsx("circle", { cx: "9.5", cy: "15.3", r: "1.7", fill: "#fff" })] })),
    EGY: (_jsxs(_Fragment, { children: [h3('#CE1126', '#fff', '#000'), _jsx("circle", { cx: "15", cy: "10", r: "1.8", fill: "#C09300" })] })),
    IDN: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "10", fill: "#CE1126" }), _jsx("rect", { y: "10", width: "30", height: "10", fill: "#fff" })] })),
    NGA: v3('#008751', '#fff', '#008751'),
    MAR: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#C1272D" }), _jsx("polygon", { points: "15,5.2 16.4,9.4 20.8,9.4 17.2,12 18.6,16.2 15,13.6 11.4,16.2 12.8,12 9.2,9.4 13.6,9.4", fill: "none", stroke: "#006233", strokeWidth: "0.8" })] })),
    TUN: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#E70013" }), _jsx("circle", { cx: "15", cy: "10", r: "5", fill: "#fff" }), crescent(15, 10, 3.8, '#E70013', '#fff', 0.3), star(16.6, 10, 2, '#E70013')] })),
    UZB: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#fff" }), _jsx("rect", { width: "30", height: "6.4", fill: "#0099B5" }), _jsx("rect", { y: "13.6", width: "30", height: "6.4", fill: "#1EB53A" }), _jsx("rect", { y: "6.4", width: "30", height: "0.6", fill: "#CE1126" }), _jsx("rect", { y: "13", width: "30", height: "0.6", fill: "#CE1126" }), crescent(4.5, 3.2, 2.2, '#fff', '#0099B5', 0.38)] })),
    SAU: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#006C35" }), _jsx("rect", { x: "7", y: "6", width: "16", height: "3", rx: "1.2", fill: "#fff", opacity: "0.9" }), _jsx("rect", { x: "8", y: "12.5", width: "14", height: "1", fill: "#fff" }), _jsx("rect", { x: "21", y: "11.8", width: "1", height: "2.4", fill: "#fff" })] })),
    ETH: (_jsxs(_Fragment, { children: [h3('#078930', '#FCDD09', '#DA121A'), _jsx("circle", { cx: "15", cy: "10", r: "4", fill: "#0F47AF" }), star(15, 10, 2.6, '#FCDD09')] })),
    SDN: (_jsxs(_Fragment, { children: [h3('#D21034', '#fff', '#000'), _jsx("polygon", { points: "0,0 10,10 0,20", fill: "#007229" })] })),
    GHA: (_jsxs(_Fragment, { children: [h3('#CE1126', '#FCD116', '#006B3F'), star(15, 10, 3, '#000')] })),
    MMR: (_jsxs(_Fragment, { children: [h3('#FECB00', '#34B233', '#EA2839'), star(15, 10.6, 6.5, '#fff')] })),
    VNM: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#DA251D" }), star(15, 10.5, 6, '#FFFF00')] })),
    YEM: h3('#CE1126', '#fff', '#000'),
    JOR: (_jsxs(_Fragment, { children: [h3('#000', '#fff', '#007A3D'), _jsx("polygon", { points: "0,0 15,10 0,20", fill: "#CE1126" }), star(5, 10, 1.8, '#fff')] })),
    SYR: (_jsxs(_Fragment, { children: [h3('#CE1126', '#fff', '#000'), star(10.5, 10, 1.8, '#007A3D'), star(19.5, 10, 1.8, '#007A3D')] })),
    TZA: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#1EB53A" }), _jsx("polygon", { points: "30,0 30,20 0,20", fill: "#00A3DD" }), _jsx("polygon", { points: "0,17 0,20 4.5,20 30,3 30,0 25.5,0", fill: "#FCD116" }), _jsx("polygon", { points: "0,18.4 0,20 2.4,20 30,1.6 30,0 27.6,0", fill: "#000" })] })),
    AFG: v3('#000', '#D32011', '#007A36'),
    BEN: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#FCD116" }), _jsx("rect", { y: "10", width: "30", height: "10", fill: "#E8112D" }), _jsx("rect", { width: "12", height: "20", fill: "#008751" })] })),
    RWA: (_jsxs(_Fragment, { children: [_jsx("rect", { width: "30", height: "20", fill: "#00A1DE" }), _jsx("rect", { y: "12", width: "30", height: "4", fill: "#FAD201" }), _jsx("rect", { y: "16", width: "30", height: "4", fill: "#20603D" }), _jsx("circle", { cx: "23", cy: "5", r: "2.2", fill: "#E5BE01" })] })),
};
// Flags whose emblem sits at the hoist keep it in the circle.
const HOIST = new Set(['PHL', 'PAK', 'SDN', 'JOR', 'BEN', 'NPL', 'LKA', 'UZB']);
/** A nationality's flag in a circle (a globe for one not drawn here). */
export function Flag({ code, size = 24, title }) {
    const art = code ? FLAGS[code.toUpperCase()] : undefined;
    return (_jsx(Box, { component: "span", title: title, sx: { display: 'inline-grid', placeItems: 'center', width: size, height: size, borderRadius: '50%', overflow: 'hidden', flex: '0 0 auto', bgcolor: '#E2E8F0', boxShadow: '0 0 0 2px #fff, 0 1px 4px rgba(15,39,71,.25)' }, children: art ? (_jsx("svg", { viewBox: "0 0 30 20", width: size, height: size, "aria-hidden": true, preserveAspectRatio: HOIST.has(code.toUpperCase()) ? 'xMinYMid slice' : 'xMidYMid slice', style: { display: 'block' }, children: art })) : (_jsx(PublicOutlinedIcon, { sx: { fontSize: size * 0.72, color: '#64748B' } })) }));
}
