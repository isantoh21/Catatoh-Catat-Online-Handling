import { supabase } from './supabaseClient';

export const logActivity = async (action: string, description: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase.from('activity_logs').insert([
      {
        user_id: session.user.id,
        action,
        description
      }
    ]);
    
    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (err) {
    console.error('Failed to log activity', err);
  }
};
