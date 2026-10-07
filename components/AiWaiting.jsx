'use client';
import { useEffect, useState } from 'react';

// Hiệu ứng chờ khi AI đang soạn barem hoặc đang chấm bài.
// Dùng:  {busy && <AiWaiting kind="rubric" />}   hoặc   {busy && <AiWaiting kind="grade" />}
// Các câu chạy chữ chỉ minh hoạ các bước AI đang làm, KHÔNG phải tiến độ thật (AI không báo tiến độ),
// nên thanh bên dưới là thanh chạy liên tục, không hiện phần trăm giả.
const STEPS = {
  rubric: [
    'AI đang đọc đề bài và yêu cầu',
    'AI đang chia các tiêu chí chấm',
    'AI đang cân điểm cho từng tiêu chí',
    'AI đang viết mô tả các mức điểm',
    'Sắp xong rồi, AI đang kiểm tra lại tổng điểm',
  ],
  grade: [
    'AI đang đọc bài làm của học sinh',
    'AI đang đối chiếu với từng tiêu chí trong barem',
    'AI đang chọn câu hay và chỗ cần sửa',
    'AI đang viết nhận xét',
    'Sắp xong rồi, AI đang kiểm tra lại điểm',
  ],
};

export default function AiWaiting({ kind = 'rubric', steps, compact = false }) {
  const list = steps || STEPS[kind] || STEPS.rubric;
  const [sec, setSec] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const idx = Math.min(list.length - 1, Math.floor(sec / 6));
  const slow = sec >= 30;
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');

  return (
    <div className={`aiw ${compact ? 'compact' : ''}`} role="status" aria-label="AI đang làm việc, vui lòng chờ">
      <style jsx>{`
        .aiw { position: relative; overflow: hidden; border-radius: 18px; padding: 22px 20px; margin: 4px 0 16px;
          background: linear-gradient(135deg, #f2f8ff, #f7f3ff); border: 1.5px solid #cfe2f7; }
        .aiw.compact { padding: 14px 16px; border-radius: 14px; margin: 0; }
        .row { display: flex; align-items: center; gap: 16px; }
        .orb { position: relative; width: 54px; height: 54px; flex: none; }
        .compact .orb { width: 38px; height: 38px; }
        .ring { position: absolute; inset: 0; border-radius: 50%; border: 3px solid transparent;
          border-top-color: #225da3; border-right-color: #8b5cf6; animation: spin 1.1s linear infinite; }
        .ring.r2 { inset: 8px; border-top-color: #3b82f6; border-right-color: #f59e0b; animation-duration: 1.7s; animation-direction: reverse; }
        .compact .ring.r2 { inset: 6px; }
        .core { position: absolute; inset: 0; display: grid; place-items: center; font-size: 20px; animation: pulse 1.6s ease-in-out infinite; }
        .compact .core { font-size: 14px; }
        .txt { min-width: 0; flex: 1; }
        .t1 { font-size: 15px; font-weight: 700; color: #17302d; }
        .compact .t1 { font-size: 13.5px; }
        .dots::after { content: ''; display: inline-block; width: 1.2em; text-align: left; animation: dots 1.4s steps(4, end) infinite; }
        .t2 { margin-top: 3px; font-size: 12.5px; color: #6b7f7a; }
        .bar { position: relative; height: 6px; border-radius: 999px; background: #dbe7f3; margin-top: 16px; overflow: hidden; }
        .compact .bar { margin-top: 10px; }
        .bar i { position: absolute; top: 0; bottom: 0; width: 40%; border-radius: 999px;
          background: linear-gradient(90deg, #225da3, #8b5cf6, #225da3); animation: slide 1.4s ease-in-out infinite; }
        .skel { margin-top: 16px; display: grid; gap: 10px; }
        .compact .skel { display: none; }
        .sk { height: 46px; border-radius: 12px; background: linear-gradient(90deg, #eaf1f9 25%, #f6f9fd 50%, #eaf1f9 75%);
          background-size: 200% 100%; animation: shimmer 1.6s linear infinite; }
        .sk:nth-child(2) { width: 92%; animation-delay: 0.15s; }
        .sk:nth-child(3) { width: 84%; animation-delay: 0.3s; }
        .slow { margin-top: 12px; font-size: 13px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 8px 12px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
        @keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75%, 100% { content: '...'; } }
        @keyframes slide { 0% { left: -40%; } 100% { left: 100%; } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @media (prefers-reduced-motion: reduce) {
          .ring, .core, .bar i, .sk, .dots::after { animation: none; }
          .bar i { left: 0; width: 100%; opacity: 0.5; }
          .dots::after { content: '...'; }
        }
      `}</style>

      <div className="row">
        <div className="orb" aria-hidden="true">
          <span className="ring" />
          <span className="ring r2" />
          <span className="core">{kind === 'grade' ? '📝' : '✨'}</span>
        </div>
        <div className="txt">
          <div className="t1">{list[idx]}<span className="dots" aria-hidden="true" /></div>
          <div className="t2">Đã chờ {mm}:{ss}. Thầy/cô vui lòng không đóng trang.</div>
        </div>
      </div>
      <div className="bar" aria-hidden="true"><i /></div>
      {kind === 'rubric' && (
        <div className="skel" aria-hidden="true"><div className="sk" /><div className="sk" /><div className="sk" /></div>
      )}
      {slow && (
        <div className="slow">
          Hôm nay AI trả lời chậm hơn bình thường. Hệ thống vẫn đang chờ và sẽ tự thử mô hình khác nếu cần.
        </div>
      )}
    </div>
  );
}
