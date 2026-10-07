import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Học sinh nộp (hoặc nộp lại) ảnh bài vẽ Mỹ thuật.
// POST FormData: assignmentId, image (JPEG), quality (JSON do bước kiểm tra ảnh gửi lên).
// Kiểm: là học sinh, đề thuộc lớp mình, đề không phải "vẽ trên web", chưa quá hạn, bài chưa chấm,
// ảnh <= 3 MB và đúng đầu tệp JPEG. Lưu ảnh (ghi đè bản cũ) rồi ghi dòng art_submissions.
export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_BYTES = 3 * 1024 * 1024
const BUCKET = 'art-submissions'
const CODES = ['very_dark', 'dark', 'very_blur', 'blur', 'blur_or_blank', 'shadow', 'small']
const VERDICTS = ['ok', 'warn', 'bad']

const num = (v, min, max, digits = 3) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  const c = Math.min(max, Math.max(min, n))
  const k = Math.pow(10, digits)
  return Math.round(c * k) / k
}

// Chỉ giữ các trường biết trước và kẹp giá trị vào khoảng hợp lý.
function cleanQuality(raw) {
  let q = {}
  try { q = JSON.parse(String(raw || '{}')) } catch (e) { q = {} }
  if (!q || typeof q !== 'object') q = {}
  const out = {}
  out.verdict = VERDICTS.includes(q.verdict) ? q.verdict : 'ok'
  out.sentAnyway = q.sentAnyway === true
  out.ack = q.ack === true
  out.codes = Array.isArray(q.codes) ? q.codes.filter((c) => CODES.includes(c)).slice(0, 8) : []
  const m = q.metrics && typeof q.metrics === 'object' ? q.metrics : {}
  out.metrics = {}
  const put = (obj, key, val) => { if (val !== undefined) obj[key] = val }
  put(out.metrics, 'brightness', num(m.brightness, 0, 255, 0))
  put(out.metrics, 'sharpness', num(m.sharpness, 0, 1000, 1))
  put(out.metrics, 'shadow', num(m.shadow, 0, 1, 2))
  put(out.metrics, 'w', num(m.w, 0, 20000, 0))
  put(out.metrics, 'h', num(m.h, 0, 20000, 0))
  put(out.metrics, 'longSide', num(m.longSide, 0, 40000, 0))
  const e = q.edits && typeof q.edits === 'object' ? q.edits : {}
  out.edits = {}
  out.edits.rot = [0, 90, 180, 270].includes(Number(e.rot)) ? Number(e.rot) : 0
  const c = e.crop && typeof e.crop === 'object' ? e.crop : {}
  out.edits.crop = {
    x: num(c.x, 0, 1) ?? 0, y: num(c.y, 0, 1) ?? 0,
    w: num(c.w, 0, 1) ?? 1, h: num(c.h, 0, 1) ?? 1,
  }
  out.edits.brightness = num(e.brightness, -100, 100, 0) ?? 0
  out.edits.contrast = num(e.contrast, -100, 100, 0) ?? 0
  out.edits.whiten = e.whiten === true
  return out
}

function fail(message, status) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request) {
  // 1. Đăng nhập
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return fail('Em chưa đăng nhập', 401)
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user) return fail('Phiên đăng nhập đã hết hạn, em hãy đăng nhập lại', 401)
  const uid = userData.user.id

  // 2. Phải là học sinh
  const { data: profile } = await supabaseAdmin.from('profiles').select('role, class_id').eq('id', uid).maybeSingle()
  if (!profile || profile.role !== 'student') return fail('Chỉ học sinh mới nộp bài được', 403)
  if (!profile.class_id) return fail('Tài khoản của em chưa được xếp lớp', 403)

  // 3. Đọc dữ liệu gửi lên
  let form
  try { form = await request.formData() } catch (e) { return fail('Dữ liệu gửi lên không hợp lệ', 400) }
  const assignmentId = String(form.get('assignmentId') || '')
  const image = form.get('image')
  if (!assignmentId) return fail('Thiếu mã bài giao', 400)
  if (!image || typeof image === 'string' || typeof image.arrayBuffer !== 'function') return fail('Chưa có ảnh bài vẽ', 400)
  if (image.size > MAX_BYTES) return fail('Ảnh lớn quá 3 MB, em hãy chọn lại hoặc cắt bớt', 413)
  if (image.size < 1024) return fail('Ảnh quá nhỏ hoặc bị lỗi', 400)

  // 4. Kiểm bài giao
  const { data: a } = await supabaseAdmin
    .from('art_assignments')
    .select('id, class_id, submit_mode, due_date')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!a) return fail('Không tìm thấy bài giao này', 404)
  if (a.class_id !== profile.class_id) return fail('Bài này không phải của lớp em', 403)
  if (a.submit_mode === 'web_draw') return fail('Bài này yêu cầu vẽ trên web, chưa nộp bằng ảnh được', 400)
  if (a.due_date && new Date(a.due_date).getTime() < Date.now()) return fail('Đã hết hạn nộp bài này', 403)

  // 5. Bài đã chấm thì không nộp lại
  const { data: old } = await supabaseAdmin
    .from('art_submissions')
    .select('id, status')
    .eq('assignment_id', assignmentId)
    .eq('student_id', uid)
    .maybeSingle()
  if (old && old.status === 'graded') return fail('Bài này đã được chấm nên không nộp lại được', 409)

  // 6. Đúng đầu tệp JPEG (FF D8 FF)
  const buf = Buffer.from(await image.arrayBuffer())
  if (buf.length < 3 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    return fail('Tệp không phải ảnh JPEG hợp lệ', 400)
  }

  // 7. Lưu ảnh (ghi đè bản cũ) rồi ghi dòng nộp bài
  const path = `${assignmentId}/${uid}.jpg`
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true })
  if (up.error) return fail('Không lưu được ảnh: ' + up.error.message, 500)

  // Không gửi submitted_at: lần đầu lấy mặc định now(), nộp lại thì giữ nguyên giờ nộp đầu.
  const { error: dbError } = await supabaseAdmin
    .from('art_submissions')
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: uid,
        image_path: path,
        quality: cleanQuality(form.get('quality')),
        status: 'submitted',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'assignment_id,student_id' }
    )
  if (dbError) return fail('Không ghi được bài nộp: ' + dbError.message, 500)

  return NextResponse.json({ success: true, resubmitted: !!old })
}
