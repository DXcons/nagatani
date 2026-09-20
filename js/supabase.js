// ============================================================
// Supabase接続設定
// Supabaseプロジェクトの Project Settings → API から取得した値に
// 書き換えてください。
// ============================================================
const SUPABASE_URL = "https://mrltgxgklzyskulzedmr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__eOeAbedUnIPcGkFU2IXHg_D7ad-FhE";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- 共通ヘルパー ----

async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

async function getMyProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) {
    console.error("プロフィール取得エラー:", error);
    return null;
  }
  return data;
}

const ROLE_PAGE = { driver: "driver.html", haisya: "haisya.html", office: "office.html" };

async function requireProfile(expectedRole) {
  const profile = await getMyProfile();
  if (!profile) {
    window.location.href = "login.html";
    return null;
  }
  if (expectedRole && profile.role !== expectedRole) {
    window.location.href = ROLE_PAGE[profile.role] || "driver.html";
    return null;
  }
  return profile;
}

async function requireProfileIn(allowedRoles) {
  const profile = await getMyProfile();
  if (!profile) {
    window.location.href = "login.html";
    return null;
  }
  if (allowedRoles && allowedRoles.indexOf(profile.role) === -1) {
    window.location.href = ROLE_PAGE[profile.role] || "driver.html";
    return null;
  }
  return profile;
}

async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function todayLabel(dateKey) {
  const d = dateKey ? new Date(dateKey + "T00:00:00") : new Date();
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function timeLabel(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function yen(n) {
  if (n === null || n === undefined || n === "") return "-";
  return "¥" + Number(n).toLocaleString("ja-JP");
}
