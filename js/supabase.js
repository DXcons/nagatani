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

// admin（管理者）は3つの画面すべてに入れる
const ROLE_PAGE = { driver: "driver.html", haisya: "haisya.html", office: "office.html", admin: "office.html" };

async function requireProfile(expectedRole) {
  const profile = await getMyProfile();
  if (!profile) {
    window.location.href = "login.html";
    return null;
  }
  if (expectedRole && profile.role !== expectedRole && profile.role !== "admin") {
    window.location.href = ROLE_PAGE[profile.role] || "driver.html";
    return null;
  }
  addAdminSwitcher(profile);
  return profile;
}

async function requireProfileIn(allowedRoles) {
  const profile = await getMyProfile();
  if (!profile) {
    window.location.href = "login.html";
    return null;
  }
  if (allowedRoles && allowedRoles.indexOf(profile.role) === -1 && profile.role !== "admin") {
    window.location.href = ROLE_PAGE[profile.role] || "driver.html";
    return null;
  }
  addAdminSwitcher(profile);
  return profile;
}

// 管理者のときだけ、画面上部に「ドライバー／配車／事務」の切り替えボタンを出す
function addAdminSwitcher(profile) {
  if (!profile || profile.role !== "admin") return;
  const nav = document.querySelector("header.topbar nav");
  if (!nav || nav.querySelector("[data-admin-switcher]")) return;
  const wrap = document.createElement("span");
  wrap.setAttribute("data-admin-switcher", "1");
  wrap.style.cssText = "display:inline-flex;flex-wrap:wrap;gap:8px;padding-right:10px;margin-right:2px;border-right:2px solid #e2e8f0;";
  [["driver.html", "🚚 ドライバー"], ["haisya.html", "📋 配車"], ["office.html", "🏢 事務"]].forEach(function (p) {
    const a = document.createElement("a");
    a.className = "btn admin-switch" + (location.pathname.endsWith("/" + p[0]) ? " is-current" : "");
    a.href = p[0];
    a.textContent = p[1];
    wrap.appendChild(a);
  });
  nav.insertBefore(wrap, nav.firstChild);
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

// 配車日報（report_days）の運転手名：運転手リストの名前を優先し、なければログインアカウントの名前
function dayDriverName(rd) {
  if (!rd) return "";
  if (rd.drivers && rd.drivers.name) return rd.drivers.name;
  if (rd.profiles && rd.profiles.name) return rd.profiles.name;
  return "";
}
