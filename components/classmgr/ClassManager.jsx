'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { permsFor, roleText } from '@/lib/roles';
import { CmRoot, CmToast } from './Ui';
import MembersPanel from './MembersPanel';
import SeatDesigner from './SeatDesigner';
import RecordPanel from './RecordPanel';
import DutyPanel from './DutyPanel';
import ReportPanel from './ReportPanel';
import ReportInbox from './ReportInbox';
import LaborPanel from './LaborPanel';
import GroupJournal from './GroupJournal';

// Bộ công cụ quản lý lớp. Dùng ở:
//   - trang giáo viên chủ nhiệm (isStaff = true): đủ mọi tab
//   - trang học sinh có chức vụ ban cán sự (isStaff = false): chỉ hiện tab phù hợp chức vụ
export default function ClassManager({ classId, className, isStaff, role, roleGroup, profileId }) {
  const perms = useMemo(() => permsFor(role, isStaff), [role, isStaff]);
  const [students, setStudents] = useState([]);
  const [groupCount, setGroupCount] = useState(4);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState('');
  const [pendingReports, setPendingReports] = useState(0); // số báo cáo của học sinh chưa xem (chỉ giáo viên)

  const reload = useCallback(async () => {
    const [s, l] = await Promise.all([
      supabase.rpc('class_students', { p_class_id: classId }),
      supabase.rpc('class_get_layout', { p_class_id: classId }),
    ]);
    if (s.error) setMsg({ type: 'error', text: s.error.message });
    else setStudents(s.data || []);
    if (l.data) setGroupCount(l.data.group_count);
    setLoading(false);
  }, [classId]);

  const loadPending = useCallback(async () => {
    if (!perms.staff) return;
    const { data } = await supabase.rpc('class_list_member_reports', { p_class_id: classId });
    setPendingReports((data || []).filter((r) => r.status === 'pending').length);
  }, [classId, perms.staff]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);
  useEffect(() => { loadPending(); }, [loadPending]);

  const tabs = useMemo(() => {
    const t = [];
    if (perms.report) t.push({ key: 'bao-cao', label: 'Báo cáo tuần' });
    if (perms.staff) t.push({ key: 'bao-cao-hs', label: pendingReports > 0 ? `Báo cáo từ học sinh (${pendingReports})` : 'Báo cáo từ học sinh' });
    if (perms.violation || perms.singing || perms.academic || perms.cadre) t.push({ key: 'ghi-nhan', label: 'Ghi nhận' });
    if (perms.duty || perms.dutyLog) t.push({ key: 'truc-nhat', label: 'Trực nhật' });
    if (perms.dutyLog) t.push({ key: 'lao-dong', label: 'Kiểm tra lao động' });
    if (perms.staff) t.push({ key: 'nhat-ky', label: 'Nhật ký theo tổ' });
    if (perms.seat) t.push({ key: 'so-do', label: 'Sơ đồ lớp & tổ' });
    if (perms.staff) t.push({ key: 'hoc-sinh', label: 'Học sinh & ban cán sự' });
    return t;
  }, [perms, pendingReports]);

  const current = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key;

  if (!perms.view) return <CmRoot><div className="cm-card"><div className="cm-empty">Bạn chưa có chức vụ nào trong lớp này.</div></div></CmRoot>;

  return (
    <CmRoot>
      {!isStaff && role && (
        <div className="cm-card" style={{ background: '#fff8f7', borderColor: '#f0c4c0' }}>
          <b>{roleText(role, roleGroup)}</b> · Lớp {className}
          <div className="cm-hint" style={{ margin: 0 }}>Bạn chỉ thấy những công cụ dành cho chức vụ của mình.</div>
        </div>
      )}
      <div className="cm-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" className={`cm-tab ${current === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {loading ? <div className="cm-card"><div className="cm-empty">Đang tải…</div></div> : (
        <>
          {current === 'ghi-nhan' && <RecordPanel classId={classId} students={students} perms={perms} role={role} roleGroup={roleGroup} profileId={profileId} toast={setMsg} />}
          {current === 'truc-nhat' && <DutyPanel classId={classId} students={students} perms={perms} role={role} roleGroup={roleGroup} toast={setMsg} />}
          {current === 'lao-dong' && <LaborPanel classId={classId} students={students} perms={perms} role={role} roleGroup={roleGroup} toast={setMsg} />}
          {current === 'nhat-ky' && <GroupJournal classId={classId} toast={setMsg} />}
          {current === 'so-do' && <SeatDesigner classId={classId} students={students} reload={reload} toast={setMsg} />}
          {current === 'hoc-sinh' && <MembersPanel classId={classId} students={students} groupCount={groupCount} reload={reload} toast={setMsg} />}
          {current === 'bao-cao' && <ReportPanel classId={classId} className={className} toast={setMsg} />}
          {current === 'bao-cao-hs' && <ReportInbox classId={classId} toast={setMsg} onChanged={loadPending} />}
        </>
      )}
      <CmToast msg={msg} onDone={() => setMsg(null)} />
    </CmRoot>
  );
}
