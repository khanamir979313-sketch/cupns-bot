/**
 * CUPNS WHOLESALE EXCHANGE · ENTERPRISE MASTER V10
 * 14 ADMIN COMMANDS · MULTI-KEY WIZARD · STRICT SECURITY
 */

const BOT_TOKEN = "8792200997:AAFCRS95C21zNMLMYsgAsb6ihMVDDaoQeno";
const API = "https://api.telegram.org/bot" + BOT_TOKEN;
const CHANNEL = "@cupnx";
const UPI_ID = "amandeep@fam";
const CRYPTO_ADDR = "0x47c74e6D3331e22C0c12e10079909DA84Aa98eef";

const DB = {
  admins: new Set(["8241668673"]),
  maint: false,
  withdrawLock: false,
  usdRate: 100.0,
  perRefINR: 1.0,
  starsRate: 1.5,
  usedUTRs: new Set(),
  activeMsg: new Map(),
  pendingReceipts: new Map(),
  channels: [
    { id: "-1001", name: "CupponsHub Official", link: "https://t.me/readymade_accont", checked: true },
    { id: "-1002", name: "CupponsHub Community", link: "https://t.me/CupponHubXGroup", checked: true },
    { id: "-1003", name: "Exchange Feed", link: "https://t.me/cupnx", checked: false },
    { id: "-1004", name: "Support Desk", link: "https://t.me/Groupsphere", checked: false }
  ],
  products: [
    { id: "gemini_link", name: "GEMINI LINK", inr: 65, keys: ["GEM-VIP-89420", "GEM-VIP-10492"] },
    { id: "duo_super", name: "Duolingo Super 12M", inr: 45, keys: ["DUO-AUTH-991"] },
    { id: "adobe_exp", name: "Adobe Express 12M", inr: 35, keys: ["ADB-EX-101"] },
    { id: "spotify_3m", name: "Spotify 3M REEDEM", inr: 5, keys: ["SPO-RED-001"] },
    { id: "crunchy_1m", name: "CRUNCHYROLL 1M", inr: 5, keys: ["CRU-PREM-88"] }
  ],
  users: new Map(),
  session: new Map()
};

const NAV = {
  keyboard: [
    [{ text: "🎫 Vouchers" }, { text: "💳 Add Funds" }],
    [{ text: "👤 My Profile" }, { text: "📦 Order Vault" }],
    [{ text: "🤝 Refer & Earn" }, { text: "🆘 Support" }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

export default {
  async fetch(req) {
    if (req.method === "POST") {
      try {
        const u = await req.json();
        if (u.pre_checkout_query) {
          await call("answerPreCheckoutQuery", { pre_checkout_query_id: u.pre_checkout_query.id, ok: true });
          return new Response("OK");
        }
        if (u.message?.successful_payment) {
          const cid = u.message.chat.id.toString(), amt = u.message.successful_payment.total_amount * DB.starsRate;
          getU(cid).bal += amt;
          await send(cid, `✅ <tg-emoji emoji-id="5424818078833715060">⭐️</tg-emoji> <b>STARS DEPOSIT SETTLED</b>\n━━━━━━━━━━━━━━━━━━━━━\n• Received: ⭐️ ${u.message.successful_payment.total_amount}\n• Balance Credit: <b>+₹${amt.toFixed(2)} INR</b>`);
          return new Response("OK");
        }
        if (u.message) await onMsg(u.message);
        else if (u.callback_query) await onCb(u.callback_query);
      } catch (e) {}
      return new Response("OK");
    }
    return new Response("CUPNS Enterprise Master Live 24/7");
  }
};

function getU(id) {
  if (!DB.users.has(id)) DB.users.set(id, { bal: 0.0, orders: 0, ref: null });
  return DB.users.get(id);
}

async function onMsg(m) {
  const cid = m.chat.id.toString(), txt = (m.text || "").trim(), mid = m.message_id;
  const u = getU(cid);
  await call("deleteMessage", { chat_id: cid, message_id: mid });

  if (DB.maint && !DB.admins.has(cid) && !txt.startsWith("/admin")) {
    return sendSingle(cid, "🚨 <b>SYSTEM UNDER MAINTENANCE</b>\nClearance gateway offline.");
  }

  const s = DB.session.get(cid);
  if (s && txt !== "/cancel") {
    // UPI Flow
    if (s.step === "UPI_AMT") {
      const a = parseFloat(txt);
      if (isNaN(a) || a < 10) return sendSingle(cid, "🚨 Min deposit ₹10. Re-enter amount:");
      s.amt = a; s.step = "SUB_UTR";
      const topupId = "WT-" + Date.now().toString().slice(-8);
      const uri = `upi://pay?pa=${UPI_ID}&pn=CUPNS&am=${a.toFixed(2)}&cu=INR`;
      const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(uri)}`;
      return sendPhotoSingle(cid, qr, `💳 <tg-emoji emoji-id="5251203410396458957">⚡</tg-emoji> <b>Wallet Top-up</b>\n━━━━━━━━━━━━━━━━━━━━━\n• ID: <code>${topupId}</code>\n• Pay: <b>₹${a.toFixed(2)} INR</b>\n• Rate: 1 USDT ≈ ₹${DB.usdRate}\n• Credit: $${(a / DB.usdRate).toFixed(2)} USDT\n━━━━━━━━━━━━━━━━━━━━━\nPay via QR, then submit 12-digit UTR:`, {
        inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "dep" }]]
      });
    }
    if (s.step === "SUB_UTR") {
      const utr = txt.replace(/[^0-9]/g, "");
      if (utr.length !== 12) return sendSingle(cid, "🚨 Invalid UTR! Exact 12-digit number submit karein:");
      if (DB.usedUTRs.has(utr)) { DB.session.delete(cid); return sendSingle(cid, "🚨 Duplicate UTR! Payment already processed."); }
      DB.usedUTRs.add(utr);
      const amt = s.amt || 10;
      DB.pendingReceipts.set(utr, { cid, amt });
      DB.session.delete(cid);
      for (const adm of DB.admins) {
        send(adm, `🔔 <b>PENDING UPI APPROVAL</b>\n━━━━━━━━━━━━━━━━━━━━━\n• User: <code>${cid}</code>\n• Amount: <b>₹${amt.toFixed(2)} INR</b>\n• UTR: <code>${utr}</code>`, {
          inline_keyboard: [[{ text: `✅ Approve ₹${amt}`, callback_data: `adm_appr_${utr}` }, { text: "❌ Reject", callback_data: `adm_rej_${utr}` }]]
        });
      }
      return sendSingle(cid, `✅ <b>UTR ${utr} Logged</b>\nManual audit pending. Verification ke baad direct credit hoga.`);
    }

    // Step-by-Step Multi-Key Stock Wizard
    if (s.step === "WIZ_NAME") {
      s.name = txt; s.step = "WIZ_QTY";
      return sendSingle(cid, `📦 <b>STOCK WIZARD</b>\nItem: <b>${s.name}</b>\n\nEnter Quantity to add (e.g. 2, 5):`, {
        inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "adm_stock" }]]
      });
    }
    if (s.step === "WIZ_QTY") {
      const q = parseInt(txt);
      if (isNaN(q) || q <= 0) return sendSingle(cid, "🚨 Valid integer quantity daalein:");
      s.total = q; s.keys = []; s.step = "WIZ_KEY_LOOP";
      return sendSingle(cid, `🔑 Send 1st License Key / Code <b>(1/${q})</b>:`);
    }
    if (s.step === "WIZ_KEY_LOOP") {
      s.keys.push(txt);
      if (s.keys.length < s.total) {
        return sendSingle(cid, `✅ Key ${s.keys.length} saved.\nSend next key <b>(${s.keys.length + 1}/${s.total})</b>:`);
      }
      s.step = "WIZ_PRICE";
      return sendSingle(cid, `💰 All ${s.total} keys saved!\nEnter Price in INR (e.g. 65):`);
    }
    if (s.step === "WIZ_PRICE") {
      const prc = parseFloat(txt);
      if (isNaN(prc) || prc <= 0) return sendSingle(cid, "Valid price enter karein:");
      s.inr = prc; s.step = "WIZ_CONFIRM";
      return sendSingle(cid, `📋 <b>CONFIRM NEW STOCK DISPATCH</b>\n━━━━━━━━━━━━━━━━━━━━━\n• Name: <b>${s.name}</b>\n• Total Keys: <code>${s.keys.length}</code>\n• Price: <b>₹${s.inr.toFixed(2)} INR</b> ($${(s.inr / DB.usdRate).toFixed(2)})\n━━━━━━━━━━━━━━━━━━━━━`, {
        inline_keyboard: [
          [{ text: "🟢 Confirm & Push to Store", callback_data: "wiz_push" }],
          [{ text: "❌ Cancel", callback_data: "adm_stock" }]
        ]
      });
    }

    // Channels Add Matrix Prompts
    if (s.step === "ADM_ADD_CH_CHECK") {
      s.chId = txt; s.step = "ADM_ADD_CH_CHECK_LINK";
      return sendSingle(cid, "Send invite link for checked channel (https://t.me/...):");
    }
    if (s.step === "ADM_ADD_CH_CHECK_LINK") {
      DB.channels.push({ id: s.chId, name: s.chId, link: txt, checked: true });
      DB.session.delete(cid);
      return renderManageChannels(cid);
    }
    if (s.step === "ADM_ADD_CH_UNCHECK") {
      s.chId = txt; s.step = "ADM_ADD_CH_UNCHECK_LINK";
      return sendSingle(cid, "Send invite link for unchecked channel:");
    }
    if (s.step === "ADM_ADD_CH_UNCHECK_LINK") {
      DB.channels.push({ id: s.chId, name: s.chId, link: txt, checked: false });
      DB.session.delete(cid);
      return renderManageChannels(cid);
    }

    // Item Edit Prompts
    if (s.step === "ADM_RENAME_EXEC") {
      const p = DB.products.find(x => x.id === s.pid);
      if (p) p.name = txt;
      DB.session.delete(cid);
      return renderStockItemDetail(cid, s.pid);
    }
    if (s.step === "ADM_REPRICE_EXEC") {
      const p = DB.products.find(x => x.id === s.pid);
      const prc = parseFloat(txt);
      if (p && !isNaN(prc)) p.inr = prc;
      DB.session.delete(cid);
      return renderStockItemDetail(cid, s.pid);
    }

    // Rate & Admin Controls
    if (s.step === "SET_RATE") {
      const r = parseFloat(txt);
      if (!isNaN(r) && r > 0) { DB.usdRate = r; DB.session.delete(cid); return sendSingle(cid, `✅ Exchange Rate Set: 1 USDT = ₹${r.toFixed(2)} INR.`); }
    }
    if (s.step === "ADM_BAL_USER") { s.tgt = txt.trim(); s.step = "ADM_BAL_AMT"; return sendSingle(cid, `Enter INR to credit to ${s.tgt}:`); }
    if (s.step === "ADM_BAL_AMT") {
      const amt = parseFloat(txt);
      getU(s.tgt).bal += amt; DB.session.delete(cid);
      send(s.tgt, `✅ +₹${amt.toFixed(2)} INR credited by admin.`);
      return sendSingle(cid, `✅ ₹${amt.toFixed(2)} credited to ${s.tgt}.`);
    }
    if (s.step === "ADM_BC") {
      DB.session.delete(cid);
      for (const [uid] of DB.users) send(uid, `📢 <b>ANNOUNCEMENT</b>\n━━━━━━━━━━━━━━━━━━━━━\n${txt}`);
      return sendSingle(cid, "✅ Broadcast completed.");
    }
  }

  if (txt === "/cancel") { DB.session.delete(cid); return sendSingle(cid, "✅ Cancelled.", NAV); }
  if (txt.startsWith("/start")) {
    const parts = txt.split(" ");
    if (parts[1]?.startsWith("ref_") && !u.ref) {
      const r = parts[1].replace("ref_", "");
      if (r !== cid && DB.users.has(r)) { u.ref = r; getU(r).bal += DB.perRefINR; send(r, `⚡ Referral lead settled! +₹${DB.perRefINR.toFixed(2)} INR`); }
    }
    return renderForceJoin(cid);
  }
  if ((txt === "/adminhelp" || txt === "/admin") && (DB.admins.has(cid) || cid === "8241668673")) {
    DB.admins.add(cid); return renderAdminHub(cid);
  }

  if (txt.includes("Vouchers")) return renderVoucherCatalog(cid);
  if (txt.includes("Add Funds")) return renderFundingGateway(cid);
  if (txt.includes("My Profile")) return renderClientProfile(cid);
  if (txt.includes("Order Vault")) return sendSingle(cid, "📦 <b>ORDER VAULT</b>\nNo pending deliveries. Purchased licenses appear here.");
  if (txt.includes("Refer & Earn")) {
    const me = await call("getMe");
    const l = `https://t.me/${me.result.username}?start=ref_${cid}`;
    return sendSingle(cid, `🤝 <b>AFFILIATE REWARD NETWORK</b>\nEarn ₹${DB.perRefINR.toFixed(2)} per lead.\nLink: <code>${l}</code>`, {
      inline_keyboard: [[{ text: "📢 Share Referral Link", url: `https://t.me/share/url?url=${encodeURIComponent(l)}` }], [{ text: "⬅️ Back", callback_data: "cat" }]]
    });
  }
  if (txt.includes("Support")) {
    return sendSingle(cid, "🆘 <b>OFFICIAL EXECUTIVE DESK</b>\n━━━━━━━━━━━━━━━━━━━━━\n• Clearance Lead: @Maybegodx\n• Live Feed: @cupnx\nDirect assistance online 24/7.", {
      inline_keyboard: [[{ text: "💬 Contact Lead (@Maybegodx)", url: "https://t.me/Maybegodx" }]]
    });
  }
}

async function onCb(cb) {
  const cid = cb.message.chat.id.toString(), mid = cb.message.message_id, d = cb.data;
  await call("answerCallbackQuery", { callback_query_id: cb.id });
  const u = getU(cid);

  if (d === "verify_force_join") return renderVoucherCatalog(cid);
  if (d === "cat") return renderVoucherCatalog(cid);
  if (d === "dep") return renderFundingGateway(cid);
  if (d === "prof") return renderClientProfile(cid);

  if (d === "pay_upi") { DB.session.set(cid, { step: "UPI_AMT" }); return edit(cid, mid, "💳 <b>ADD FUNDS (UPI)</b>\nEnter amount in INR (Min ₹10):", { inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "dep" }]] }); }
  if (d === "pay_crypto") return edit(cid, mid, `💎 <b>USDT (BEP20) SETTLEMENT</b>\nNode: <code>${CRYPTO_ADDR}</code>\nOfficial Binance-Peg contract only. Flash USDT blocked.`, { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "dep" }]] });
  if (d === "pay_stars") { DB.session.set(cid, { step: "STARS_QTY" }); return edit(cid, mid, "⭐️ <b>TELEGRAM STARS</b>\nEnter Stars count (100 ⭐️ = ₹150 INR):", { inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "dep" }]] }); }

  if (d.startsWith("buy_")) {
    const p = DB.products.find(x => x.id === d.replace("buy_", ""));
    if (!p) return;
    const usd = (p.inr / DB.usdRate).toFixed(2);
    return edit(cid, mid, `🛒 <b>PURCHASE CONFIRMATION</b>\n━━━━━━━━━━━━━━━━━━━━━\n• Item: <code>${p.name}</code>\n• Stock: <code>${p.keys.length}</code>\n• Price: <b>₹${p.inr.toFixed(2)} INR</b> ($${usd})\n• Balance: <b>₹${u.bal.toFixed(2)} INR</b>\n━━━━━━━━━━━━━━━━━━━━━`, {
      inline_keyboard: [
        u.bal >= p.inr && p.keys.length ? [{ text: `🟢 Confirm & Pay (₹${p.inr})`, callback_data: "exec_" + p.id }] : [{ text: "💳 Add Funds", callback_data: "dep" }],
        [{ text: "⬅️ Cancel", callback_data: "cat" }]
      ]
    });
  }

  if (d.startsWith("exec_")) {
    const p = DB.products.find(x => x.id === d.replace("exec_", ""));
    if (!p || !p.keys.length || u.bal < p.inr) return;
    u.bal -= p.inr; u.orders++;
    const key = p.keys.shift();
    await edit(cid, mid, `✅ <b>PURCHASE DISPATCHED</b>\n━━━━━━━━━━━━━━━━━━━━━\n• Item: <code>${p.name}</code>\n• License / Key:\n<code>${key}</code>\n━━━━━━━━━━━━━━━━━━━━━\nStored in Order Vault.`);
    const ist = new Date(Date.now() + 19800000).toLocaleString("en-IN") + " IST";
    const mask = cid.length > 5 ? cid.slice(0, 2) + "*****" + cid.slice(-3) : cid + "*****";
    const me = await call("getMe");
    return call("sendMessage", {
      chat_id: CHANNEL,
      text: `✅ <b>New Purchase!</b>\n━━━━━━━━━━━━━━━━━━━━━\n🧾 ID: <code>${mask}</code>\n🟢 Product: <b>${p.name}</b>\n📦 Quantity: <code>1</code>\n💸 Payment: <code>Wallet</code>\n🕒 Time: <code>${ist}</code>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: `🟢 Buy ${p.name} ↗️`, url: `https://t.me/${me.result.username}?start=store` }]] }
    });
  }

  if (d === "adm_hub") return renderAdminHub(cid);
  if (d === "adm_channels") return renderManageChannels(cid);
  if (d === "adm_add_chk_ch") { DB.session.set(cid, { step: "ADM_ADD_CH_CHECK" }); return edit(cid, mid, "Send Channel Name/ID for checked channel:", { inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "adm_channels" }]] }); }
  if (d === "adm_add_unchk_ch") { DB.session.set(cid, { step: "ADM_ADD_CH_UNCHECK" }); return edit(cid, mid, "Send Channel Name/ID for unchecked channel:", { inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "adm_channels" }]] }); }
  if (d === "adm_stock") return renderManageStock(cid);
  if (d === "adm_add_stock") { DB.session.set(cid, { step: "WIZ_NAME" }); return edit(cid, mid, "➕ <b>STOCK WIZARD</b>\nSend Product Name:", { inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "adm_stock" }]] }); }
  if (d === "wiz_push") {
    const s = DB.session.get(cid);
    DB.products.push({ id: "p_" + Date.now().toString().slice(-6), name: s.name, inr: s.inr, keys: s.keys });
    DB.session.delete(cid);
    return renderManageStock(cid);
  }

  if (d.startsWith("adm_stock_det_")) {
    const pid = d.replace("adm_stock_det_", "");
    return renderStockItemDetail(cid, pid);
  }
  if (d.startsWith("adm_rename_p_")) {
    const pid = d.replace("adm_rename_p_", "");
    DB.session.set(cid, { step: "ADM_RENAME_EXEC", pid });
    return edit(cid, mid, "Send new name for product:", { inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "adm_stock_det_" + pid }]] });
  }
  if (d.startsWith("adm_reprice_p_")) {
    const pid = d.replace("adm_reprice_p_", "");
    DB.session.set(cid, { step: "ADM_REPRICE_EXEC", pid });
    return edit(cid, mid, "Send new price in INR:", { inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "adm_stock_det_" + pid }]] });
  }
  if (d.startsWith("adm_del_key_")) {
    const [pid, kidx] = d.replace("adm_del_key_", "").split("_");
    const p = DB.products.find(x => x.id === pid);
    if (p) p.keys.splice(parseInt(kidx), 1);
    return renderStockItemDetail(cid, pid);
  }
  if (d.startsWith("adm_del_entire_")) {
    const pid = d.replace("adm_del_entire_", "");
    DB.products = DB.products.filter(p => p.id !== pid);
    return renderManageStock(cid);
  }

  if (d === "adm_rate") { DB.session.set(cid, { step: "SET_RATE" }); return edit(cid, mid, `💱 Current: 1 USDT = ₹${DB.usdRate}\nSend naya conversion rate in INR:`, { inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "adm_hub" }]] }); }
  if (d === "adm_maint") { DB.maint = !DB.maint; return renderAdminHub(cid); }
  if (d === "adm_w_toggle") { DB.withdrawLock = !DB.withdrawLock; return renderAdminHub(cid); }
  if (d === "adm_bc") { DB.session.set(cid, { step: "ADM_BC" }); return edit(cid, mid, "Send broadcast announcement:", { inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "adm_hub" }]] }); }
  if (d === "adm_bal") { DB.session.set(cid, { step: "ADM_BAL_USER" }); return edit(cid, mid, "Enter target User ID:", { inline_keyboard: [[{ text: "⬅️ Cancel", callback_data: "adm_hub" }]] }); }

  if (d.startsWith("ch_up_")) {
    const idx = parseInt(d.replace("ch_up_", ""));
    if (idx > 0) { const temp = DB.channels[idx]; DB.channels[idx] = DB.channels[idx - 1]; DB.channels[idx - 1] = temp; }
    return renderManageChannels(cid);
  }
  if (d.startsWith("ch_down_")) {
    const idx = parseInt(d.replace("ch_down_", ""));
    if (idx < DB.channels.length - 1) { const temp = DB.channels[idx]; DB.channels[idx] = DB.channels[idx + 1]; DB.channels[idx + 1] = temp; }
    return renderManageChannels(cid);
  }
  if (d.startsWith("ch_del_")) { DB.channels.splice(parseInt(d.replace("ch_del_", "")), 1); return renderManageChannels(cid); }

  if (d.startsWith("adm_appr_")) {
    const utr = d.replace("adm_appr_", "");
    const r = DB.pendingReceipts.get(utr);
    if (r) {
      getU(r.cid).bal += r.amt; DB.pendingReceipts.delete(utr);
      send(r.cid, `✅ <b>PAYMENT APPROVED</b>\n+₹${r.amt.toFixed(2)} INR credited to wallet.`);
      return edit(cid, mid, `✅ UTR ${utr} Approved! Funds credited.`);
    }
  }
  if (d.startsWith("adm_rej_")) {
    const utr = d.replace("adm_rej_", "");
    DB.pendingReceipts.delete(utr);
    return edit(cid, mid, `❌ UTR ${utr} Rejected.`);
  }
}

function renderForceJoin(cid) {
  const rows = [];
  for (let i = 0; i < DB.channels.length; i += 2) {
    const r = [{ text: `🚨 Join ${i + 1} ↗️`, url: DB.channels[i].link }];
    if (DB.channels[i + 1]) r.push({ text: `🚨 Join ${i + 2} ↗️`, url: DB.channels[i + 1].link });
    rows.push(r);
  }
  rows.push([{ text: "⚡ JOINED", callback_data: "verify_force_join" }]);
  return sendSingle(cid, "📱 <b>CUPNS WHOLESALE EXCHANGE</b>\nMembership clearance required to access exchange:", { inline_keyboard: rows });
}

function renderVoucherCatalog(cid) {
  const u = getU(cid);
  const rows = [];
  for (const p of DB.products) {
    const usd = (p.inr / DB.usdRate).toFixed(2);
    rows.push([{ text: `🟢 Buy ${p.name} · ₹${p.inr} / $${usd} [${p.keys.length}]`, callback_data: "buy_" + p.id }]);
  }
  rows.push([{ text: "💳 Add Funds", callback_data: "dep" }, { text: "👤 My Profile", callback_data: "prof" }]);
  return sendSingle(cid, `🏛️ <b>CUPNS WHOLESALE EXCHANGE · VOUCHERS</b>\n━━━━━━━━━━━━━━━━━━━━━\n• Balance: <b>₹${u.bal.toFixed(2)} INR</b> ($${(u.bal / DB.usdRate).toFixed(2)})\n• Clearing: <code>Autonomous FIFO (< 0.1s)</code>\n• Policy: <code>Strictly All Sales Final</code>\n━━━━━━━━━━━━━━━━━━━━━\nSelect voucher to purchase:`, { inline_keyboard: rows });
}

function renderFundingGateway(cid) {
  const u = getU(cid);
  const kb = {
    inline_keyboard: [
      [{ text: "⚡ UPI Instant (QR Code)", callback_data: "pay_upi" }, { text: "💎 Crypto (USDT BEP20)", callback_data: "pay_crypto" }],
      [{ text: "⭐️ Telegram Stars (Native)", callback_data: "pay_stars" }],
      [{ text: "⬅️ Back to Vouchers", callback_data: "cat" }]
    ]
  };
  return sendSingle(cid, `💳 <b>RECHARGE SETTLEMENT TERMINAL</b>\n• Balance: <b>₹${u.bal.toFixed(2)} INR</b>\n• Live Rate: <code>1 USDT = ₹${DB.usdRate} INR</code>`, kb);
}

function renderClientProfile(cid) {
  const u = getU(cid);
  const kb = { inline_keyboard: [[{ text: "💳 Add Funds", callback_data: "dep" }], [{ text: "⬅️ Back to Vouchers
