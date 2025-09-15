
import { supabase } from '@/lib/supabase';

export const getClients = async () => {
  const { data, error } = await supabase.from('clients').select('id, name');

  if (error) {
    console.error('Error fetching clients:', error.message);
    return [];
  }

  return data;
};
