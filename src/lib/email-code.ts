import { supabase } from '@/lib/supabase';

// Email one-time codes. Supabase emails a 6-digit code; the email template must show {{ .Token }}.
// Only existing accounts can receive a sign-in code, so unknown addresses are not revealed.

export async function sendEmailCode(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  });
  return { error: error ? error.message : null };
}

export async function verifyEmailCode(email: string, code: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.replace(/\s+/g, ''),
    type: 'email',
  });
  return { error: error ? error.message : null };
}