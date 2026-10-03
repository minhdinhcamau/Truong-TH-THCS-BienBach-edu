'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { TPT_NAV } from '@/lib/nav';
import AppShell, { Toast } from '@/components/AppShell';
import { buildTrucNhatHtml } from '@/lib/tpt/trucNhatTemplate';

// Trang /tpt/truc-nhat - So do phan cong truc nhat dang ban do (cong cu rieng, nhung qua
// <iframe srcDoc>). Danh sach lop + lich tuan luon lay THAT tu he thong (RPC
// tpt_truc_nhat_config, fix20.sql) truyen vao luc dung trang, khong con ghi cung trong file
// nhu ban goc - tranh lech voi trang "Lịch năm học" hay danh sach lop that su.
//
// TPT da dang nhap qua Supabase o day roi nen cong cu TU DONG mo khoa che do chinh sua,
// khong hoi lai ma PIN nua. Du lieu (vi tri da keo-tha) van luu trong trinh duyet cua may
// dang mo trang nay (nhu thiet ke goc) - dung nut "💾 Sao lưu" trong cong cu de tai file
// JSON ve may, phong khi doi may hoac xoa du lieu trinh duyet.

export default function TptTrucNhatPage() {
  const { profile, ready, logout } = useGuard('tpt');
  const [html, setHtml] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data, error } = await supabase.rpc('tpt_truc_nhat_config');
      if (error) {
        setMsg({ type: 'error', text: error.message });
        return;
      }
      if (!data?.START) {
        setMsg({ type: 'error', text: 'Chưa xác nhận lịch năm học. Hãy vào mục "Lịch năm học" chọn ngày bắt đầu tuần 1 trước.' });
      }
      setHtml(buildTrucNhatHtml({ CL: data?.CL, N: data?.N, START: data?.START }));
    })();
  }, [ready]);

  if (!ready) return <div className="app"><div className="center-loading">Đang tải…</div></div>;

  return (
    <AppShell profile={profile} roleLabel="Tổng phụ trách Đội" nav={TPT_NAV} activeHref="/tpt/truc-nhat" onLogout={logout}>
      <h1 className="pg-title">Trực nhật</h1>
      <p className="pg-sub">
        Kéo-thả phân công lớp trực theo từng khu vực trên bản đồ trường. Danh sách lớp và số tuần lấy theo đúng dữ liệu hệ thống.
      </p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {!html ? (
          <div className="empty">Đang tải bản đồ…</div>
        ) : (
          <iframe
            title="Sơ đồ phân công trực nhật"
            srcDoc={html}
            style={{ width: '100%', height: '82vh', minHeight: 560, border: 'none', display: 'block' }}
          />
        )}
      </div>
      <p className="hint">
        Dữ liệu phân công được lưu trong trình duyệt của máy đang mở trang này. Dùng nút "💾 Sao lưu" bên trong để tải file JSON về máy phòng khi đổi máy hoặc xoá dữ liệu trình duyệt.
      </p>

      <Toast msg={msg} onDone={() => setMsg(null)} />
    </AppShell>
  );
}
