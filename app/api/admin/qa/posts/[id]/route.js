import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'
import { requireAdmin } from '../../../../../../lib/authHelpers'

// Xem chi tiet 1 bai Hoi bai (ke ca bai da bi hoc sinh tu xoa / da vao kho
// luu tru) — dung khi admin bam vao 1 dong trong danh sach de "xem bai do
// nhu the nao". Tra ve day du: noi dung, TAT CA anh, binh luan, bao cao.
export async function GET(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = params

  const { data: post, error: postError } = await supabaseAdmin
    .from('qa_posts')
    .select(
      'id, content, photo_url, created_at, deleted_by_student, deleted_at, student_id, profiles!qa_posts_student_id_fkey(full_name, classes(name)), subjects(name)'
    )
    .eq('id', id)
    .single()

  if (postError || !post) {
    // TAM THOI: hien loi that de debug, se doi lai sau khi tim ra nguyen nhan
    return NextResponse.json(
      { error: 'Khong tim thay bai dang nay', debug: postError?.message || 'post is null/undefined' },
      { status: 404 }
    )
  }

  const { data: photos } = await supabaseAdmin
    .from('qa_post_photos')
    .select('id, photo_url, sort_order')
    .eq('post_id', id)
    .order('sort_order', { ascending: true })

  // Chi lay binh luan CHUA bi xoa (deleted_at is null) — binh luan da xoa
  // (kieu soft-delete) khong hien trong trang chi tiet nay.
  const { data: replies } = await supabaseAdmin
    .from('qa_replies')
    .select('id, content, marked_useful, created_at, profiles!qa_replies_author_id_fkey(full_name, role)')
    .eq('post_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  // Luu y: qa_reports chi co cot "details" (khong co "other_reason").
  const { data: reports } = await supabaseAdmin
    .from('qa_reports')
    .select('id, reason, details, created_at, profiles!qa_reports_reporter_id_fkey(full_name)')
    .eq('post_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    post: {
      id: post.id,
      content: post.content,
      photoUrl: post.photo_url,
      createdAt: post.created_at,
      deletedByStudent: post.deleted_by_student,
      deletedAt: post.deleted_at,
      studentName: post.profiles?.full_name || '—',
      className: post.profiles?.classes?.name || '—',
      subjectName: post.subjects?.name || null,
    },
    photos: (photos || []).map((p) => ({ id: p.id, url: p.photo_url })),
    replies: (replies || []).map((r) => ({
      id: r.id,
      content: r.content,
      markedUseful: r.marked_useful,
      createdAt: r.created_at,
      authorName: r.profiles?.full_name || '—',
      authorRole: r.profiles?.role,
    })),
    reports: (reports || []).map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      createdAt: r.created_at,
      reporterName: r.profiles?.full_name || '—',
    })),
  })
}

// Xoa bai — 2 che do:
//   { mode: 'archive' } -> chi CHUYEN VAO KHO LUU TRU (danh dau
//                          deleted_by_student/deleted_at), du lieu KHONG mat
//   { mode: 'purge' }   -> XOA VINH VIEN: xoa anh that trong Storage, xoa
//                          qa_post_photos + qa_replies (cascade), roi xoa
//                          dong qa_posts
export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const { mode } = await request.json().catch(() => ({}))

  if (mode !== 'archive' && mode !== 'purge') {
    return NextResponse.json({ error: 'Thieu mode: "archive" hoac "purge"' }, { status: 400 })
  }

  if (mode === 'archive') {
    const { error } = await supabaseAdmin
      .from('qa_posts')
      .update({ deleted_by_student: true, deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, mode: 'archive' })
  }

  // mode === 'purge': xoa anh that trong Storage TRUOC khi xoa dong DB,
  // gom ca photo_url cu (bai 1 anh) lan qa_post_photos (bai nhieu anh).
  const { data: post } = await supabaseAdmin.from('qa_posts').select('photo_url').eq('id', id).maybeSingle()
  const { data: photos } = await supabaseAdmin.from('qa_post_photos').select('photo_url').eq('post_id', id)

  const allUrls = [post?.photo_url, ...(photos || []).map((p) => p.photo_url)].filter(Boolean)
  const paths = allUrls.map((url) => url.replace(/^.*qa-photos\//, '')).filter(Boolean)

  if (paths.length > 0) {
    await supabaseAdmin.storage.from('qa-photos').remove(paths)
  }

  // qa_post_photos, qa_replies, qa_likes, qa_reports deu "on delete
  // cascade" theo post_id (da xac nhan) nen chi can xoa dong qa_posts la du.
  const { error } = await supabaseAdmin.from('qa_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, mode: 'purge' })
}

// Phuc hoi bai da bi chuyen vao kho luu tru (thay the RPC admin_restore_qa_post
// da bi xoa trong migration don dep).
export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = params

  const { error } = await supabaseAdmin
    .from('qa_posts')
    .update({ deleted_by_student: false, deleted_at: null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
