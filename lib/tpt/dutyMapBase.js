// Nền bản đồ trường dùng cho sơ đồ trực nhật (SVG tĩnh).
// Khung nhìn: viewBox "92 52 826 836". Vị trí các tòa nhà GIỮ NGUYÊN so với bản cũ nên các khu vực đã vẽ vẫn khớp.
// Tên các dãy nhà, khu vực ghi theo ảnh vệ tinh do nhà trường chú thích.
// Các khu vực trực nhật được vẽ đè lên nền này (khu vực Sân khấu do Tổng phụ trách tự vẽ thêm như mọi khu vực khác).
export const DUTY_VIEWBOX = '92 52 826 836';

// 12 màu khác nhau rõ rệt cho 12 lớp (mỗi khu vực một màu)
export const ZONE_COLORS = [
  '#d62839', '#f58220', '#e0b000', '#7cb518', '#12894a', '#14b8a6',
  '#38bdf8', '#1d4ed8', '#7c3aed', '#c026d3', '#f472b6', '#78350f',
];

// Màu chưa dùng đầu tiên trong bảng 12 màu (hết thì xoay vòng)
export function pickZoneColor(usedColors) {
  const used = new Set((usedColors || []).map((c) => String(c).toLowerCase()));
  const free = ZONE_COLORS.find((c) => !used.has(c));
  return free || ZONE_COLORS[(usedColors || []).length % ZONE_COLORS.length];
}

// Nhãn dạng viên thuốc (nền tối mờ, chữ trắng) để dễ đọc trên mái ngói. rot = -90 cho dãy nhà nằm dọc.
function tag(cx, cy, text, { fs = 13, rot = 0, ls = 1, bg = '#4a1a14', op = 0.74 } = {}) {
  const w = Math.round(text.length * (fs * 0.64 + ls) + 22);
  const h = Math.round(fs + 11);
  const turn = rot ? ` rotate(${rot})` : '';
  return `<g transform="translate(${cx} ${cy})${turn}"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${bg}" fill-opacity="${op}"/><text y="${Math.round(fs * 0.36)}" text-anchor="middle" font-size="${fs}" font-weight="800" letter-spacing="${ls}" fill="#fff">${text}</text></g>`;
}

// Ngôi sao vàng nhỏ trên tấm phông đỏ của sân khấu
function star(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (-90 + i * 36) * (Math.PI / 180);
    const d = i % 2 === 0 ? R : r;
    pts.push(`${(cx + d * Math.cos(a)).toFixed(1)},${(cy + d * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="#f5c518"/>`;
}

const labels = [
  tag(617, 238, 'DÃY GIỮA'),
  tag(180, 425, 'NHÀ THỰC HÀNH', { rot: -90 }),
  tag(350, 440, 'DÃY TRÁI', { rot: -90 }),
  tag(812, 517, 'DÃY PHẢI', { rot: -90 }),
  tag(186, 180, 'NHÀ VỆ SINH NAM', { fs: 10.5, ls: 0.5 }),
  tag(828, 112, 'NHÀ VỆ SINH NỮ', { fs: 10.5, ls: 0.5 }),
  tag(228, 750, 'KHU VỰC NHÀ XE', { fs: 12.5 }),
].join('');

export const DUTY_MAP_BASE = `
<defs>
 <linearGradient id="roof" x1="0" x2="1"><stop offset="0" stop-color="#d4705c"/><stop offset="1" stop-color="#a8402f"/></linearGradient>
 <pattern id="tile" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7H14" stroke="#000" stroke-opacity=".14" stroke-width="1.5"/></pattern>
 <linearGradient id="hall" x1="0" x2="1"><stop offset="0" stop-color="#cfe8dc"/><stop offset="1" stop-color="#a9cdbd"/></linearGradient>
 <linearGradient id="yard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a99a92"/><stop offset="1" stop-color="#97867f"/></linearGradient>
 <pattern id="stgTile" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#858c92"/><rect width="6" height="6" fill="#a9afb4"/><rect x="6" y="6" width="6" height="6" fill="#a9afb4"/></pattern>
 <pattern id="grass" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#dfe9d2"/><circle cx="5" cy="6" r="1.3" fill="#c9dbb8"/><circle cx="16" cy="15" r="1.3" fill="#c9dbb8"/></pattern>
 <filter id="sh" x="-10%" y="-10%" width="125%" height="125%"><feDropShadow dx="4" dy="8" stdDeviation="5" flood-color="#000" flood-opacity=".34"/></filter>
 <filter id="sh2" x="-10%" y="-10%" width="125%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".35"/></filter>
 <g id="rf" stroke="#f3c7bc" stroke-width="3" stroke-linejoin="round"><rect x="155" y="85" width="63" height="73" rx="3"/><rect x="762" y="75" width="133" height="70" rx="3"/><rect x="415" y="158" width="405" height="107"/><rect x="120" y="232" width="120" height="385"/><rect x="293" y="242" width="115" height="386"/><rect x="745" y="285" width="135" height="465"/><rect x="110" y="715" width="237" height="70" rx="26"/><rect x="368" y="722" width="122" height="65" rx="8"/><rect x="515" y="718" width="50" height="52"/></g>
</defs>
<rect x="0" y="0" width="1040" height="1040" fill="url(#grass)"/>
<rect x="118" y="70" width="780" height="728" rx="6" fill="#dad0ba"/>
<rect x="435" y="76" width="326" height="76" fill="#d6bc8c"/>
<rect x="415" y="268" width="335" height="530" fill="url(#yard)"/>
<g stroke="#fff" stroke-opacity=".07" stroke-width="2"><path d="M415 330H750M415 400H750M415 470H750M415 540H750M415 610H750M415 680H750M415 750H750"/></g>
<rect x="478" y="548" width="224" height="124" rx="6" fill="#4a7592"/>
<rect x="490" y="560" width="200" height="100" rx="3" fill="#5b8fb0"/>
<g stroke="#f4f7f9" stroke-width="2.6" fill="none"><rect x="490" y="560" width="200" height="100" rx="3"/><path d="M557 560V660M623 560V660"/></g>
<path d="M590 553V667" stroke="#1f2937" stroke-width="4"/>
<path d="M590 553V667" stroke="#fff" stroke-width="1.4" stroke-dasharray="2.5 2.5"/>
<g fill="#1f2937" stroke="#fff" stroke-width="1.5"><circle cx="590" cy="553" r="4.5"/><circle cx="590" cy="667" r="4.5"/></g>
<rect x="90" y="806" width="830" height="50" fill="#d6d2c9"/><path d="M90 806H920M90 856H920" stroke="#aaa598" stroke-width="3"/>
<path d="M195 806v50M285 806v50M375 806v50M465 806v50M560 806v50M650 806v50M740 806v50M830 806v50" stroke="#bdb8ac" stroke-width="1.6"/>
<g filter="url(#sh)"><use href="#rf" fill="url(#roof)"/><use href="#rf" fill="url(#tile)"/>
<rect x="498" y="278" width="175" height="247" rx="3" fill="url(#hall)" stroke="#e8f5ee" stroke-width="3"/></g>
<g stroke="#f7d6cd" stroke-width="4" fill="none" stroke-linecap="round"><path d="M415 158L470 205H765L820 158M415 265L470 205M820 265L765 205M180 240V610M300 250L350 300L400 250M350 300V612M300 620L350 585L400 620M812 292V742M524 720L565 770M565 720L524 770M186 92V152M828 82V138"/></g>
<g stroke="#e3f3ea" stroke-width="3" fill="none"><path d="M585 368V523"/><path d="M498 396H673M498 462H673" stroke-opacity=".5" stroke-width="2"/></g>
<g fill="#7aa896"><rect x="494" y="274" width="8" height="8" rx="2"/><rect x="669" y="274" width="8" height="8" rx="2"/><rect x="494" y="521" width="8" height="8" rx="2"/><rect x="669" y="521" width="8" height="8" rx="2"/><rect x="494" y="392" width="8" height="8" rx="2"/><rect x="669" y="392" width="8" height="8" rx="2"/><rect x="494" y="458" width="8" height="8" rx="2"/><rect x="669" y="458" width="8" height="8" rx="2"/></g>
<g filter="url(#sh2)">
 <rect x="502" y="282" width="167" height="12" fill="#233267"/>
 <rect x="532" y="282" width="38" height="12" fill="#b3202f"/>
 ${star(551, 288, 4, 1.7)}
 <rect x="502" y="294" width="167" height="52" fill="url(#stgTile)" stroke="#5f666c" stroke-width="1.5"/>
 <rect x="502" y="346" width="19" height="19" fill="#c9ced2" stroke="#7b838a" stroke-width="1.5"/>
 <rect x="650" y="346" width="19" height="19" fill="#c9ced2" stroke="#7b838a" stroke-width="1.5"/>
 <rect x="521" y="346" width="129" height="6" fill="#b9bfc4" stroke="#7b838a" stroke-width="1"/>
 <rect x="521" y="352" width="129" height="6" fill="#d9dde0" stroke="#7b838a" stroke-width="1"/>
 <rect x="521" y="358" width="129" height="6" fill="#b9bfc4" stroke="#7b838a" stroke-width="1"/>
</g>
<text x="585.5" y="324" text-anchor="middle" font-size="11.5" font-weight="800" letter-spacing="1" fill="#fff" stroke="#3b4046" stroke-width="3" paint-order="stroke" stroke-linejoin="round">KHU VỰC SÂN KHẤU</text>
<text x="585.5" y="495" text-anchor="middle" font-size="11" font-weight="800" fill="#4d7566" letter-spacing="1.5">KHU VỰC MÁI CHE</text>
${labels}
<g font-weight="700" letter-spacing="2" fill="#fff" fill-opacity=".92" text-anchor="middle" font-size="12">
 <text x="590" y="696" fill="#fff">SÂN BÓNG CHUYỀN</text>
 <text x="640" y="750" fill="#fff" fill-opacity=".8" font-size="12.5">SÂN TRƯỚC</text>
</g>
<path d="M570 797H118V70H898V797H660" fill="none" stroke="#6a6a66" stroke-width="4"/>
<path d="M570 797H118V70H898V797H660" fill="none" stroke="#2f2f2d" stroke-width="10" stroke-dasharray="3 25"/>
<g><rect x="570" y="774" width="14" height="34" rx="2" fill="#8a2f22" stroke="#e8c9c0" stroke-width="2"/><rect x="646" y="774" width="14" height="34" rx="2" fill="#8a2f22" stroke="#e8c9c0" stroke-width="2"/><path d="M584 782H646" stroke="#2f2f2d" stroke-width="3" stroke-dasharray="6 5"/><path d="M584 802L604 791M646 802L626 791" stroke="#555" stroke-width="4" stroke-linecap="round"/><text x="615" y="836" text-anchor="middle" font-size="12.5" font-weight="700" fill="#6b665b" letter-spacing="2">CỔNG TRƯỜNG</text></g>
`;
