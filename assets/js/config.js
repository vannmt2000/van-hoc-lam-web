// ============================================
// CẤU HÌNH CHUNG - SUPABASE CLIENT
// File này dùng cho TẤT CẢ các trang
// ============================================

const SUPABASE_URL = 'https://pffbnfysvhiumzhfvnos.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmJuZnlzdmhpdW16aGZ2bm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTMxODYsImV4cCI6MjEwNjcyOTE4Nn0.qQpHpeXW4xnGdLxLIwDhBIabYipSwqAxAhtvRPDiGMs';

// Tạo client DUY NHẤT dùng chung
window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: true,
            storageKey: 'ots-erp-auth',
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    }
);

console.log('✅ Supabase client initialized');


// ============================================
// CONFIG: TẠO USER (HR dùng)
// ============================================

window.USER_CREATE_CONFIG = {
  // Format pass tạm
  password: {
    prefix: 'Ots@',       // ← ĐỔI Ở ĐÂY khi muốn đổi format
    length: 6,             // Số ký tự random
    chars: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  },
  
  // Session timeout (phút)
  idleTimeout: 15,
  
  // Mặc định khi tạo user mới
  defaultRole: 'staff',
  defaultPasswordChanged: false,  // false = bắt buộc đổi pass lần đầu
  
  // Số thiết bị tối đa
  maxDevices: {
    staff: 2,
    manager: 2,
    hr: 2,
    it: 2,
    admin: 3
  }
};

// ============================================
// HÀM SINH PASS TẠM
// ============================================
window.generateTempPassword = function() {
  const cfg = window.USER_CREATE_CONFIG.password;
  let pass = cfg.prefix;
  for (let i = 0; i < cfg.length; i++) {
    pass += cfg.chars.charAt(Math.floor(Math.random() * cfg.chars.length));
  }
  return pass;
};

console.log('✅ User create config loaded');