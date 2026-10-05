// ============================================
// FILE CẤU HÌNH - KHÔNG chứa logic
// Chỉ chứa URL và Key của Supabase
// ============================================

const SUPABASE_URL = 'https://pffbnfysvhiumzhfvnos.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmJuZnlzdmhpdW16aGZ2bm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTMxODYsImV4cCI6MjEwNjcyOTE4Nn0.qQpHpeXW4xnGdLxLIwDhBIabYipSwqAxAhtvRPDiGMs';

// Khởi tạo Supabase client
if (typeof window.supabase === 'undefined') {
    console.error('❌ Supabase CDN chưa load!');
} else {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Đã kết nối Supabase');
}
