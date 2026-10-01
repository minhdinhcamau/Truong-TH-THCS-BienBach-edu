// CHỈ dùng trong API route (server)
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { gradeEssay } from './litAi';

// Đọc token từ header "Authorization: Bearer ..." rồi kiểm tra vai trò
export async function requireUser(request, roles) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { error: 'Thiếu token xác thực', status: 401 };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { error: 'Token không hợp lệ hoặc đã hết hạn', status: 401 };

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, class_id, is_tpt')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile) return { error: 'Không tìm thấy hồ sơ tài khoản', status: 403 };
  if (roles && !roles.includes(profile.role)) {
    return { error: 'Bạn không có quyền thực hiện thao tác này', status: 403 };
  }
  return { user: data.user, profile };
}

// Chấm 1 bài bằng AI rồi lưu vào lit_grades. Trả về kết quả chấm.
export async function gradeAndSave(submissionId) {
  const { data: sub } = await supabaseAdmin
    .from('lit_submissions').select('*').eq('id', submissionId).single();
  if (!sub) throw new Error('Không tìm thấy bài làm');

  const { data: assignment } = await supabaseAdmin
    .from('lit_assignments').select('*').eq('id', sub.assignment_id).single();
  const { data: criteria } = await supabaseAdmin
    .from('lit_criteria').select('*').eq('assignment_id', sub.assignment_id).order('sort_order');
  if (!criteria || criteria.length === 0) throw new Error('Đề này chưa có barem');

  const { data: existing } = await supabaseAdmin
    .from('lit_grades').select('published').eq('submission_id', submissionId).maybeSingle();
  if (existing?.published) {
    throw new Error('Bài đã công bố điểm. Hãy hủy công bố trước khi chấm lại');
  }

  const result = await gradeEssay({ assignment, criteria, content: sub.content });

  const row = {
    submission_id: submissionId,
    ai_result: result,
    final_result: result,
    total: result.total,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await supabaseAdmin.from('lit_grades').update(row).eq('submission_id', submissionId)
    : await supabaseAdmin.from('lit_grades').insert({ ...row, published: false });
  if (error) throw new Error(error.message);

  await supabaseAdmin.from('lit_submissions').update({ status: 'ai_graded' }).eq('id', submissionId);
  return result;
}
