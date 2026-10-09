'use client';
// GAME (tách riêng): chỗ giữ cho map SÂN TRƯỜNG (bước vào cổng trường sẽ sang đây). Map này sẽ làm ở gói sau.
// Xóa cùng thư mục components/game khi gỡ game.
export default function CourtyardView({ onBack }) {
  return (
    <div className="gm-done">
      <div className="gm-panel" style={{ textAlign: 'center' }}>
        <div className="gm-lbl">Sân trường Biển Bạch</div>
        <div className="gm-hint">Em đã bước qua cổng trường! Sân trường và các lớp học đang được xây dựng, sẽ mở ở bản cập nhật sau. Em chờ nhé.</div>
        <div className="gm-actions">
          <button type="button" className="gm-btn main big" onClick={onBack}>Quay ra cổng trường</button>
        </div>
      </div>
    </div>
  );
}
