'use client';
import Link from 'next/link';

// Đầu trang của một môn học: ảnh huy hiệu môn + mô tả ngắn + nút quay về trang các môn
export default function SubjectHeader({ slug, title, subtitle, children }) {
  return (
    <header className="sh">
      <style jsx>{`
        .sh { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; background: #fff; border: 1px solid #dbe5f3; border-radius: 22px;
          padding: 18px 26px 18px 18px; margin-bottom: 22px; position: relative; overflow: hidden;
          box-shadow: 0 14px 30px -24px rgba(11,42,102,0.55); font-family: 'Be Vietnam Pro', system-ui, sans-serif; }
        .sh::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: linear-gradient(180deg, #0a52c7, #2a9df4); }
        .art { width: 132px; height: 132px; border-radius: 28px; background: radial-gradient(circle at 30% 22%, #ffffff, #e8f0fc 72%); display: grid; place-items: center; padding: 10px; flex: none; }
        .art img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .txt { flex: 1; min-width: 220px; }
        .back { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: #0a52c7; text-decoration: none; margin-bottom: 8px; }
        .back:hover { text-decoration: underline; }
        h1 { margin: 0; font-size: 26px; line-height: 1.2; color: #12263f; font-weight: 800; }
        p { margin: 6px 0 0; font-size: 14px; color: #5c6f86; line-height: 1.55; max-width: 560px; }
        .extra { margin-top: 12px; }
        @media (max-width: 560px) { .art { width: 96px; height: 96px; border-radius: 22px; } h1 { font-size: 21px; } .sh { padding-right: 18px; gap: 16px; } }
      `}</style>
      <div className="art"><img src={`/mon-hoc/${slug}.png`} alt="" width="112" height="112" /></div>
      <div className="txt">
        <Link href="/student" className="back">← Tất cả môn học</Link>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children && <div className="extra">{children}</div>}
      </div>
    </header>
  );
}
