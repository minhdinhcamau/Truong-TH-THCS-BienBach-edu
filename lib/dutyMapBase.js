// Nền bản đồ trường dùng cho sơ đồ trực nhật (SVG tĩnh, giữ nguyên hình vẽ của bản cũ).
// Khung nhìn: viewBox "92 52 826 836". Các khu vực trực nhật được vẽ đè lên nền này.
export const DUTY_VIEWBOX = '92 52 826 836';

export const DUTY_MAP_BASE = `
<defs>
 <linearGradient id="roof" x1="0" x2="1"><stop offset="0" stop-color="#cf6653"/><stop offset="1" stop-color="#a03d2d"/></linearGradient>
 <pattern id="tile" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7H14" stroke="#000" stroke-opacity=".16" stroke-width="1.5"/></pattern>
 <linearGradient id="hall" x1="0" x2="1"><stop offset="0" stop-color="#c3dfd2"/><stop offset="1" stop-color="#9fc4b4"/></linearGradient>
 <linearGradient id="yard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9b8983"/><stop offset="1" stop-color="#8b7973"/></linearGradient>
 <filter id="sh" x="-10%" y="-10%" width="125%" height="125%"><feDropShadow dx="4" dy="8" stdDeviation="5" flood-color="#000" flood-opacity=".38"/></filter>
 <g id="rf" stroke="#f3c7bc" stroke-width="3" stroke-linejoin="round"><rect x="155" y="85" width="63" height="73" rx="3"/><rect x="762" y="75" width="133" height="70" rx="3"/><rect x="415" y="158" width="405" height="107"/><rect x="120" y="232" width="120" height="385"/><rect x="293" y="242" width="115" height="386"/><rect x="745" y="285" width="135" height="465"/><rect x="110" y="715" width="237" height="70" rx="26"/><rect x="368" y="722" width="122" height="65" rx="8"/><rect x="515" y="718" width="50" height="52"/></g>
</defs>
<rect x="0" y="0" width="1040" height="1040" fill="#e4eadb"/>
<rect x="118" y="70" width="780" height="728" rx="6" fill="#d0c5ae"/>
<rect x="435" y="76" width="326" height="76" fill="#cdb182"/>
<rect x="415" y="268" width="335" height="530" fill="url(#yard)"/>
<rect x="490" y="560" width="200" height="100" fill="#a58e86"/>
<g stroke="#f1eae5" stroke-width="3" fill="none"><rect x="490" y="560" width="200" height="100"/><path d="M590 560V660M557 560V660M623 560V660"/></g>
<g fill="#4a3f3b"><rect x="586" y="550" width="8" height="11" rx="2"/><rect x="586" y="659" width="8" height="11" rx="2"/></g>
<rect x="90" y="806" width="830" height="50" fill="#d3cfc6"/><path d="M90 806H920M90 856H920" stroke="#aaa598" stroke-width="3"/>
<path d="M195 806v50M285 806v50M375 806v50M465 806v50M560 806v50M650 806v50M740 806v50M830 806v50" stroke="#bdb8ac" stroke-width="1.6"/>
<g filter="url(#sh)"><use href="#rf" fill="url(#roof)"/><use href="#rf" fill="url(#tile)"/>
<rect x="498" y="278" width="175" height="247" fill="url(#hall)" stroke="#e5f3ec" stroke-width="3"/></g>
<g stroke="#f7d6cd" stroke-width="4" fill="none" stroke-linecap="round"><path d="M415 158L470 205H765L820 158M415 265L470 205M820 265L765 205M180 240V610M300 250L350 300L400 250M350 300V612M300 620L350 585L400 620M812 292V742M524 720L565 770M565 720L524 770M186 92V152M828 82V138"/></g>
<path d="M585 280V523" stroke="#d9eee5" stroke-width="4"/>
<path d="M570 797H118V70H898V797H660" fill="none" stroke="#6a6a66" stroke-width="4"/>
<path d="M570 797H118V70H898V797H660" fill="none" stroke="#2f2f2d" stroke-width="10" stroke-dasharray="3 25"/>
<g><rect x="570" y="774" width="14" height="34" rx="2" fill="#8a2f22" stroke="#e8c9c0" stroke-width="2"/><rect x="646" y="774" width="14" height="34" rx="2" fill="#8a2f22" stroke="#e8c9c0" stroke-width="2"/><path d="M584 782H646" stroke="#2f2f2d" stroke-width="3" stroke-dasharray="6 5"/><path d="M584 802L604 791M646 802L626 791" stroke="#555" stroke-width="4" stroke-linecap="round"/></g>
`;
