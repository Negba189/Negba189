import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dqxxozqolpthkxmmheaw.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxeHhvenFvbHB0aGt4bW1oZWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMDU4MTAsImV4cCI6MjEwNjg4MTgxMH0.QvYJTMS1557F6EoMYUrFnkDpFZCzsgeeiVHDZD4Kvyc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});
