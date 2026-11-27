// ============================================================
// 配車メモ → 配車日報への割り当て（事務画面・配車画面で共通）
// 使う前に loadAssignContext() で運転手リスト・単価マスタ・名前の対応表を読み込む
// ============================================================

async function loadAssignContext() {
  var [{ data: driverRows }, { data: rateRows }, { data: destRows }, { data: boxRows }] = await Promise.all([
    supabaseClient.from("drivers").select("*").eq("active", true).order("kind").order("sort_order").order("name"),
    supabaseClient.from("rate_items").select("*"),
    supabaseClient.from("destinations").select("name, invoice_name"),
    supabaseClient.from("box_types").select("name, invoice_name")
  ]);
  var ctx = { drivers: driverRows || [], rateItems: rateRows || [], destInvoiceName: {}, itemInvoiceName: {} };
  (destRows || []).forEach(function (d) { if (d.invoice_name) ctx.destInvoiceName[d.name] = d.invoice_name; });
  (boxRows || []).forEach(function (b) { if (b.invoice_name) ctx.itemInvoiceName[b.name] = b.invoice_name; });
  return ctx;
}

// 1件の配車メモを運転手（運転手リストのID）に割り当てる。成功したら null、失敗したらエラー文を返す
async function assignMemoToDriver(memo, driverId, ctx) {
  // ログインアカウントがある運転手なら、本人がアプリで開く日報と同じものに入れる
  var master = ctx.drivers.find(function (d) { return d.id === driverId; });
  var dayQuery = supabaseClient.from("report_days").select("*").eq("report_date", memo.memo_date);
  dayQuery = master && master.profile_id
    ? dayQuery.or("driver_master_id.eq." + driverId + ",driver_id.eq." + master.profile_id)
    : dayQuery.eq("driver_master_id", driverId);
  var { data: existingDays } = await dayQuery;
  var existingDay = (existingDays || [])[0];

  var reportDayId;
  if (existingDay) {
    reportDayId = existingDay.id;
    if (!existingDay.driver_master_id) {
      await supabaseClient.from("report_days").update({ driver_master_id: driverId }).eq("id", existingDay.id);
    }
  } else {
    var { data: createdDay, error: dayErr } = await supabaseClient
      .from("report_days")
      .insert({
        driver_master_id: driverId,
        driver_id: master ? master.profile_id : null,
        report_date: memo.memo_date,
        vehicle_no: master ? master.vehicle_no : null
      })
      .select().single();
    if (dayErr) return "配車日報の作成に失敗しました: " + dayErr.message;
    reportDayId = createdDay.id;
  }

  var { count } = await supabaseClient
    .from("report_rows").select("id", { count: "exact", head: true })
    .eq("report_day_id", reportDayId);

  // 配車メモの名前を、配車日報・請求書用の名前に置き換える（未設定ならそのまま）
  var destination = ctx.destInvoiceName[memo.destination] || memo.destination;
  var itemName = ctx.itemInvoiceName[memo.item_name] || memo.item_name;
  var match = ctx.rateItems.find(function (r) {
    return r.customer_id === memo.customer_id && r.destination === destination && r.item_name === itemName;
  });

  var { data: newRow, error: rowErr } = await supabaseClient
    .from("report_rows")
    .insert({
      report_day_id: reportDayId,
      seq: count || 0,
      customer_id: memo.customer_id,
      origin: memo.origin,
      destination: destination,
      item_name: itemName,
      quantity: memo.quantity,
      unit_price: match ? match.unit_price : null,
      note: memo.note,
      status: "running"
    })
    .select().single();
  if (rowErr) return "明細行の作成に失敗しました: " + rowErr.message;

  var { error: memoErr } = await supabaseClient
    .from("dispatch_memo_items")
    .update({ assigned: true, assigned_driver_id: master ? master.profile_id : null, planned_driver_id: driverId, assigned_report_row_id: newRow.id })
    .eq("id", memo.id);
  if (memoErr) return "配車メモの更新に失敗しました: " + memoErr.message;
  return null;
}
