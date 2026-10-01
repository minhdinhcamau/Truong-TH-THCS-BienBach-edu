#!/usr/bin/env node
/**
 * collect_sql.js
 * Gom TẤT CẢ file .sql trong repo thành 1 file văn bản duy nhất (có mục lục),
 * sắp xếp theo thứ tự tự nhiên (fix2 < fix10 < fix11) để gửi cho Claude kiểm tra.
 *
 * Cách chạy (đứng ở thư mục gốc của repo):
 *   node collect_sql.js
 *   node collect_sql.js . all_sql_bundle.txt     (tuỳ chọn: thư mục gốc, tên file xuất)
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const outPath = path.resolve(process.argv[3] || path.join(root, "all_sql_bundle.txt"));

const IGNORE_DIRS = new Set([
  "node_modules", ".next", ".git", ".vercel", ".turbo", "dist", "build", "out", "coverage",
]);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) walk(path.join(dir, entry.name), acc);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".sql")) {
      const full = path.join(dir, entry.name);
      if (path.resolve(full) !== outPath) acc.push(full);
    }
  }
  return acc;
}

const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const files = walk(root).sort((a, b) => collator.compare(rel(a), rel(b)));

if (files.length === 0) {
  console.error("Không tìm thấy file .sql nào trong: " + root);
  process.exit(1);
}

// Cảnh báo nếu có thứ trông như khoá bí mật (nên kiểm tra trước khi gửi)
const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, "chuỗi giống JWT / API key"],
  [/sb_secret_[A-Za-z0-9_-]+/, "khoá sb_secret"],
  [/service_role\s*key/i, "nhắc tới service_role key"],
  [/password\s*[:=]\s*'[^']{4,}'/i, "mật khẩu viết thẳng trong code"],
];

let totalLines = 0;
let totalBytes = 0;
const toc = [];
const bodies = [];
const warnings = [];

files.forEach((file, i) => {
  const text = fs.readFileSync(file, "utf8");
  const stat = fs.statSync(file);
  const lines = text.split(/\r?\n/).length;
  totalLines += lines;
  totalBytes += stat.size;

  for (const [re, label] of SECRET_PATTERNS) {
    if (re.test(text)) warnings.push(`  - ${rel(file)}: ${label}`);
  }

  const n = String(i + 1).padStart(2, "0");
  toc.push(`${n}. ${rel(file)}  (${lines} dòng, ${stat.size} bytes, sửa lần cuối ${stat.mtime.toISOString().slice(0, 10)})`);
  bodies.push(
    [
      "",
      "=".repeat(78),
      `=== FILE ${n}/${String(files.length).padStart(2, "0")}: ${rel(file)}`,
      "=".repeat(78),
      text.replace(/\s+$/, ""),
      "",
    ].join("\n")
  );
});

const header = [
  "TỔNG HỢP TOÀN BỘ FILE SQL",
  `Tạo lúc: ${new Date().toISOString()}`,
  `Số file: ${files.length} | Tổng: ${totalLines} dòng, ${totalBytes} bytes`,
  "Thứ tự: sắp xếp theo tên (tự nhiên). Nếu thứ tự chạy thực tế trên Supabase khác, hãy ghi chú lại.",
  "",
  "MỤC LỤC:",
  ...toc,
].join("\n");

fs.writeFileSync(outPath, header + "\n" + bodies.join("\n"), "utf8");

console.log(`Đã gom ${files.length} file .sql -> ${outPath}`);
console.log(`Tổng: ${totalLines} dòng, ${(totalBytes / 1024).toFixed(1)} KB`);
if (totalBytes > 400 * 1024) {
  console.log("Lưu ý: file khá lớn. Nếu chat không nhận hết, hãy chia thành nhiều phần hoặc gửi từng nhóm file.");
}
if (warnings.length) {
  console.log("\n⚠️  Có thể có thông tin nhạy cảm, hãy mở file và kiểm tra/xoá trước khi gửi:");
  console.log(warnings.join("\n"));
}
