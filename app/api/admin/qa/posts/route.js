import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../../lib/authHelpers'

// Danh sach bai Hoi bai cho trang admin, phuc vu 2 tab tren thanh truot:
//   status=active   -> bai con hien thi binh thuong cho hoc sinh
//   status=archived -> bai da vao kho luu tru (qua han HOAC hoc sinh tu xoa),
//                       nhung CHUA bi xoa vinh vien
//   status=all      -> khong loc, dung cho tim kiem chung
// Route nay dung supabaseAdmin (service_role, bo qua RLS) nen phai tu tinh
// ranh gioi active/archived bang tay, dua vao qa_settings.archive_after_days
// (khac voi client thuong dang doc qua ham qa_post_visible() trong RLS).
export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'active'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20))

  const { data: settings } = await supabaseAdmin
    .from('qa_settings')
    .select('archive_after_days')
    .eq('id', 1)
    .maybeSingle()
  const archiveDays = settings?.archive_after_days ?? 5
  const archiveCutoff = new Date(Date.now() - archiveDays * 24 * 60 * 60 * 1000).toISOString()

  // Luu y: neu ten khoa ngoai profiles.id <- qa_posts.student_id trong
  // project cua anh khac "qa_posts_student_id_fkey", doi lai ten trong
  // chuoi select ben duoi cho khop (xem trong Supabase Dashboard > Database
  // > Tables > qa_posts > Foreign Keys).
  let query = supabaseAdmin
    .from('qa_posts')
    .select(
      'id, content, photo_url, created_at, deleted_by_student, deleted_at, profiles!qa_posts_student_id_fkey(full_name, classes(name)), subjects(name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (status === 'active') {
    query = query.eq('deleted_by_student', false).gte('created_at', archiveCutoff)
  } else if (status === 'archived') {
    query = query.or(`deleted_by_student.eq.true,created_at.lt.${archiveCutoff}`)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const posts = (data || []).map((p) => ({
    id: p.id,
    content: p.content,
    photoUrl: p.photo_url,
    createdAt: p.created_at,
    deletedByStudent: p.deleted_by_student,
    deletedAt: p.deleted_at,
    studentName: p.profiles?.full_name || '—',
    className: p.profiles?.classes?.name || '—',
    subjectName: p.subjects?.name || null,
    isArchived: p.deleted_by_student || p.created_at < archiveCutoff,
  }))

  return NextResponse.json({ posts, total: count || 0, page, pageSize, archiveAfterDays: archiveDays })
}
