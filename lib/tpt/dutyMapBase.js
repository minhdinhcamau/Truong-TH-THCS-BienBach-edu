// Nền bản đồ trường dùng cho sơ đồ trực nhật (SVG tĩnh, thiết kế lại gọn và đẹp hơn).
// Khung nhìn: viewBox "92 52 826 836". Vị trí các tòa nhà GIỮ NGUYÊN so với bản cũ nên các khu vực đã vẽ vẫn khớp.
// Các khu vực trực nhật được vẽ đè lên nền này.
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

// Khu vực Sân khấu nằm trong mái che (dải phía trên của mái che xanh)
export const STAGE_POINTS = '500,280 671,280 671,338 500,338';

const TREES = [
  [104, 100], [104, 170], [104, 240], [104, 310], [104, 380], [104, 450], [104, 520], [104, 590], [104, 660], [104, 730],
  [909, 100], [909, 170], [909, 240], [909, 310], [909, 380], [909, 450], [909, 520], [909, 590], [909, 660], [909, 730],
  [250, 190], [330, 190], [250, 665], [330, 665], [425, 100], [725, 100],
];
const trees = TREES.map(([x, y]) => `<g><circle cx="${x + 3}" cy="${y + 5}" r="15" fill="#000" opacity=".16"/><circle cx="${x}" cy="${y}" r="15" fill="#4f8f4a"/><circle cx="${x - 4}" cy="${y - 4}" r="8" fill="#6fae63"/></g>`).join('');

export const DUTY_MAP_BASE = `
<defs>
 <linearGradient id="roof" x1="0" x2="1"><stop offset="0" stop-color="#d4705c"/><stop offset="1" stop-color="#a8402f"/></linearGradient>
 <pattern id="tile" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7H14" stroke="#000" stroke-opacity=".14" stroke-width="1.5"/></pattern>
 <linearGradient id="hall" x1="0" x2="1"><stop offset="0" stop-color="#cfe8dc"/><stop offset="1" stop-color="#a9cdbd"/></linearGradient>
 <linearGradient id="yard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a99a92"/><stop offset="1" stop-color="#97867f"/></linearGradient>
 <linearGradient id="stg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2b676"/><stop offset="1" stop-color="#c58f4d"/></linearGradient>
 <pattern id="wood" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 6H12" stroke="#7a4a1c" stroke-opacity=".18" stroke-width="1"/></pattern>
 <pattern id="grass" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#dfe9d2"/><circle cx="5" cy="6" r="1.3" fill="#c9dbb8"/><circle cx="16" cy="15" r="1.3" fill="#c9dbb8"/></pattern>
 <filter id="sh" x="-10%" y="-10%" width="125%" height="125%"><feDropShadow dx="4" dy="8" stdDeviation="5" flood-color="#000" flood-opacity=".34"/></filter>
 <g id="rf" stroke="#f3c7bc" stroke-width="3" stroke-linejoin="round"><rect x="155" y="85" width="63" height="73" rx="3"/><rect x="762" y="75" width="133" height="70" rx="3"/><rect x="415" y="158" width="405" height="107"/><rect x="120" y="232" width="120" height="385"/><rect x="293" y="242" width="115" height="386"/><rect x="745" y="285" width="135" height="465"/><rect x="110" y="715" width="237" height="70" rx="26"/><rect x="368" y="722" width="122" height="65" rx="8"/><rect x="515" y="718" width="50" height="52"/></g>
</defs>
<rect x="0" y="0" width="1040" height="1040" fill="url(#grass)"/>
<rect x="118" y="70" width="780" height="728" rx="6" fill="#dad0ba"/>
<rect x="435" y="76" width="326" height="76" fill="#d6bc8c"/>
<rect x="415" y="268" width="335" height="530" fill="url(#yard)"/>
<g stroke="#fff" stroke-opacity=".07" stroke-width="2"><path d="M415 330H750M415 400H750M415 470H750M415 540H750M415 610H750M415 680H750M415 750H750"/></g>
<rect x="490" y="560" width="200" height="100" rx="4" fill="#5b8fb0"/>
<g stroke="#f4f7f9" stroke-width="3" fill="none"><rect x="490" y="560" width="200" height="100" rx="4"/><path d="M590 560V660"/><circle cx="590" cy="610" r="17"/><path d="M490 585H512V635H490M690 585H668V635H690"/></g>
<g fill="#3d3532"><rect x="586" y="550" width="8" height="11" rx="2"/><rect x="586" y="659" width="8" height="11" rx="2"/></g>
<rect x="90" y="806" width="830" height="50" fill="#d6d2c9"/><path d="M90 806H920M90 856H920" stroke="#aaa598" stroke-width="3"/>
<path d="M195 806v50M285 806v50M375 806v50M465 806v50M560 806v50M650 806v50M740 806v50M830 806v50" stroke="#bdb8ac" stroke-width="1.6"/>
${trees}
<g filter="url(#sh)"><use href="#rf" fill="url(#roof)"/><use href="#rf" fill="url(#tile)"/>
<rect x="498" y="278" width="175" height="247" rx="3" fill="url(#hall)" stroke="#e8f5ee" stroke-width="3"/></g>
<g stroke="#f7d6cd" stroke-width="4" fill="none" stroke-linecap="round"><path d="M415 158L470 205H765L820 158M415 265L470 205M820 265L765 205M180 240V610M300 250L350 300L400 250M350 300V612M300 620L350 585L400 620M812 292V742M524 720L565 770M565 720L524 770M186 92V152M828 82V138"/></g>
<g stroke="#e3f3ea" stroke-width="3" fill="none"><path d="M585 346V523"/><path d="M498 396H673M498 462H673" stroke-opacity=".5" stroke-width="2"/></g>
<g fill="#7aa896"><rect x="494" y="274" width="8" height="8" rx="2"/><rect x="669" y="274" width="8" height="8" rx="2"/><rect x="494" y="521" width="8" height="8" rx="2"/><rect x="669" y="521" width="8" height="8" rx="2"/><rect x="494" y="392" width="8" height="8" rx="2"/><rect x="669" y="392" width="8" height="8" rx="2"/><rect x="494" y="458" width="8" height="8" rx="2"/><rect x="669" y="458" width="8" height="8" rx="2"/></g>
<g>
 <rect x="500" y="280" width="171" height="58" rx="3" fill="url(#stg)" stroke="#8a5a26" stroke-width="2.5"/>
 <rect x="500" y="280" width="171" height="58" rx="3" fill="url(#wood)"/>
 <path d="M500 280H671V292H500Z" fill="#7a1f2b" opacity=".9"/>
 <path d="M500 292q10 8 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t11 0" fill="#7a1f2b" opacity=".9"/>
 <rect x="552" y="338" width="66" height="7" rx="2" fill="#b98448" stroke="#8a5a26" stroke-width="1.5"/>
 <text x="585.5" y="322" text-anchor="middle" font-size="15" font-weight="800" fill="#5a3512" letter-spacing="2">SÂN KHẤU</text>
</g>
<text x="585.5" y="495" text-anchor="middle" font-size="12.5" font-weight="700" fill="#4d7566" letter-spacing="3" opacity=".85">MÁI CHE</text>
<g font-weight="700" letter-spacing="2" fill="#fff" fill-opacity=".92" text-anchor="middle" font-size="12">
 <text x="590" y="690" fill="#fff">SÂN THỂ THAO</text>
 <text x="640" y="750" fill="#fff" fill-opacity=".8" font-size="12.5">SÂN TRƯỜNG</text>
</g>
<path d="M570 797H118V70H898V797H660" fill="none" stroke="#6a6a66" stroke-width="4"/>
<path d="M570 797H118V70H898V797H660" fill="none" stroke="#2f2f2d" stroke-width="10" stroke-dasharray="3 25"/>
<g><rect x="570" y="774" width="14" height="34" rx="2" fill="#8a2f22" stroke="#e8c9c0" stroke-width="2"/><rect x="646" y="774" width="14" height="34" rx="2" fill="#8a2f22" stroke="#e8c9c0" stroke-width="2"/><path d="M584 782H646" stroke="#2f2f2d" stroke-width="3" stroke-dasharray="6 5"/><path d="M584 802L604 791M646 802L626 791" stroke="#555" stroke-width="4" stroke-linecap="round"/><text x="615" y="836" text-anchor="middle" font-size="12.5" font-weight="700" fill="#6b665b" letter-spacing="2">CỔNG TRƯỜNG</text></g>
`;
