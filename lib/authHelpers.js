import { supabaseAdmin } from './supabaseAdmin'

// Doc access token tu header "Authorization: Bearer <token>" ma trang admin
// gui len, xac minh nguoi goi la ai, roi kiem tra ho co role = 'admin'
// trong bang profiles khong. Moi API route admin deu goi ham nay dau tien.
export async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    return { error: 'Thieu token xac thuc', status: 401 }
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user) {
    return { error: 'Token khong hop le hoac da het han', status: 401 }
  }

  console.log('DEBUG userId:', userData.user.id)

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  console.log('DEBUG profile:', JSON.stringify(profile))
  console.log('DEBUG profileError:', JSON.stringify(profileError))

  if (profileError || profile?.role !== 'admin') {
    return { error: 'Ban khong co quyen quan tri vien', status: 403 }
  }

  return { user: userData.user }
}
