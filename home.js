// ====================== Boot ======================
let CURRENT_USER = null;
let CURRENT_PHONE = Session.get();
if (!CURRENT_PHONE) { window.location.href = 'index.html'; }

// Product catalog
const PRODUCTS = [
  { id:'free',     name:'Welcome Free Plan',    price:0,    days:3,  daily:50,  badge:'FREE', color:'#10b981' },
  { id:'p1',       name:'Scarlet Bronze-7',     price:500,  days:7,  daily:90,  color:'#cd7f32' },
  { id:'p2',       name:'Scarlet Silver-15',    price:1500, days:15, daily:180, color:'#c0c0c0' },
  { id:'p3',       name:'Scarlet Gold-30',      price:3000, days:30, daily:280, color:'#d4af37' },
  { id:'p4',       name:'Scarlet Platinum-45',  price:5000, days:45, daily:380, color:'#e5e4e2' },
  { id:'p5',       name:'Scarlet Diamond-30',   price:8000, days:30, daily:720, color:'#b9f2ff' },
  { id:'p6',       name:'Scarlet Ruby-20',      price:12000,days:20, daily:1450,color:'#e0115f' },
  { id:'p7',       name:'Scarlet Sapphire-60',  price:20000,days:60, daily:1100,color:'#0f52ba' },
  { id:'p8',       name:'Scarlet Emerald-90',   price:35000,days:90, daily:1600,color:'#50c878' },
  { id:'p9',       name:'Scarlet VIP-120',      price:60000,days:120,daily:2400,color:'#7c3aed' }
];

async function loadUser(){
  CURRENT_USER = await DB.getUser(CURRENT_PHONE);
  if (!CURRENT_USER) { Session.clear(); window.location.href='index.html'; return; }
  renderAll();
}

function renderAll(){
  // Home
  document.getElementById('hello-name').textContent = CURRENT_USER.uid;
  document.getElementById('home-balance').innerHTML = '&#8377;' + (CURRENT_USER.balance||0).toFixed(2);
  document.getElementById('home-today').innerHTML = '+&#8377;' + computeTodayIncome().toFixed(2);
  // Mine
  document.getElementById('mine-avatar').textContent = (CURRENT_USER.uid||'U').slice(-2);
  document.getElementById('mine-uid').textContent = 'UID: ' + CURRENT_USER.uid;
  document.getElementById('mine-phone').textContent = '+91 ' + CURRENT_USER.phone;
  document.getElementById('mine-balance').innerHTML = '&#8377;' + (CURRENT_USER.balance||0).toFixed(0);
  document.getElementById('mine-promo').innerHTML = '&#8377;' + (CURRENT_USER.promotion_income||0).toFixed(0);
  document.getElementById('mine-invest').innerHTML = '&#8377;' + (CURRENT_USER.invest_income||0).toFixed(0);
  // Share
  document.getElementById('ref-code').textContent = CURRENT_USER.uid;
  const link = location.origin + location.pathname.replace('home.html','index.html') + '?ref=' + CURRENT_USER.uid;
  document.getElementById('ref-link').value = link;
  // Featured products (top 3)
  renderFeatured();
  renderProducts();
  renderOrders();
  renderMineMenu();
  renderQR(link);
}

function computeTodayIncome(){
  const orders = CURRENT_USER.orders || {};
  let total = 0;
  Object.values(orders).forEach(o => {
    if (o.last_claim && isSameDay(o.last_claim)) total += o.daily;
  });
  return total;
}

// ====================== Navigation ======================
const PAGES = ['home','income','share','mine','recharge','withdraw','records','team','about'];
function goTab(name){
  PAGES.forEach(p => {
    const el = document.getElementById('page-'+p);
    if (el) el.classList.toggle('active', p===name);
  });
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page===name);
  });
  window.scrollTo({top:0, behavior:'smooth'});
}
document.querySelectorAll('.nav-item').forEach(n => n.onclick = () => goTab(n.dataset.page));

// ====================== Welcome Popup ======================
async function welcomePopup(){
  const flag = sessionStorage.getItem('welcome_shown_' + CURRENT_PHONE);
  if (flag) return;
  sessionStorage.setItem('welcome_shown_' + CURRENT_PHONE, '1');
  await showPopup(
    '&#128176; Welcome to Scarlet Capital',
    `<div style="line-height:1.7">
      <p><b style="color:var(--gold-soft)">Hello ${CURRENT_USER.uid}!</b></p>
      <p style="margin-top:8px">Scarlet Capital is your trusted partner for <b>secure short-term investments</b>, <b>daily check-in rewards</b>, and a <b>3-level referral commission system</b>.</p>
      <p style="margin-top:8px">&#9889; Today's highlight: Diamond-30 plan now offering <b style="color:var(--gold-soft)">9% daily ROI</b>!</p>
      <p style="margin-top:8px">Spin the daily wheel to win up to &#8377;40 instantly.</p>
    </div>`,
    [{label:'Let\'s Go', primary:true}]
  );
}

// ====================== Spinner Wheel ======================
const WHEEL_SEGMENTS = [10, 15, 20, 25, 30, 35, 40, 12];
const WHEEL_COLORS = ['#7c3aed','#d4af37','#06b6d4','#ef4444','#10b981','#f59e0b','#ec4899','#3b82f6'];
function drawWheel(){
  const svg = document.getElementById('wheel-svg');
  const cx=100, cy=100, r=95;
  const seg = 360 / WHEEL_SEGMENTS.length;
  let html = '';
  WHEEL_SEGMENTS.forEach((v,i)=>{
    const a1 = (i*seg - 90) * Math.PI/180;
    const a2 = ((i+1)*seg - 90) * Math.PI/180;
    const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
    const x2 = cx + r*Math.cos(a2), y2 = cy + r*Math.sin(a2);
    html += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z" fill="${WHEEL_COLORS[i]}" stroke="#000" stroke-width="2"/>`;
    const tx = cx + (r*0.65)*Math.cos((a1+a2)/2);
    const ty = cy + (r*0.65)*Math.sin((a1+a2)/2);
    html += `<text x="${tx}" y="${ty}" fill="#fff" font-size="14" font-weight="900" text-anchor="middle" dominant-baseline="middle">${v}</text>`;
  });
  svg.innerHTML = html;
}

let spinning = false;
async function spinWheel(){
  if (spinning) return;
  if (isSameDay(CURRENT_USER.last_checkin)) {
    return showPopup('Already Spun Today','You have already claimed your daily reward. Come back tomorrow!');
  }
  spinning = true;
  const idx = Math.floor(Math.random()*WHEEL_SEGMENTS.length);
  const reward = WHEEL_SEGMENTS[idx];
  const seg = 360/WHEEL_SEGMENTS.length;
  const target = 360*6 + (360 - (idx*seg + seg/2));
  const svg = document.getElementById('wheel-svg');
  svg.style.transform = `rotate(${target}deg)`;
  setTimeout(async ()=>{
    const newBal = (CURRENT_USER.balance||0) + reward;
    await DB.updateUser(CURRENT_PHONE, { balance:newBal, last_checkin: Date.now() });
    CURRENT_USER.balance = newBal; CURRENT_USER.last_checkin = Date.now();
    renderAll();
    spinning = false;
    showPopup('&#127881; Congratulations!',`You won <b style="color:var(--gold-soft);font-size:20px">&#8377;${reward}</b>! Amount credited to your wallet.`);
  }, 4200);
}

// ====================== Gift Code ======================
async function openGiftCode(){
  if (isSameDay(CURRENT_USER.last_giftcode)) {
    return showPopup('Already Redeemed','You can redeem only <b>one gift code per day</b>. Come back tomorrow!');
  }
  const i = await showPopup('&#127873; Redeem Gift Code',
    `<div style="margin-bottom:10px;font-size:13px">Enter your 6-digit gift code below to receive a random bonus of &#8377;1 to &#8377;10.</div>
     <input id="gc-input" maxlength="6" placeholder="e.g. SC1234" style="width:100%;padding:12px;background:#000;border:1px solid var(--border);border-radius:10px;color:#fff;font-size:16px;text-align:center;letter-spacing:4px;font-weight:800">`,
    [{label:'Cancel'},{label:'Redeem',primary:true}]);
  if (i!==1) return;
  const code = document.getElementById('gc-input')?.value.trim() || '';
  if (code.length!==6) return showToast('Code must be 6 digits/chars','error');
  const reward = randInt(1,10);
  const newBal = (CURRENT_USER.balance||0) + reward;
  await DB.updateUser(CURRENT_PHONE, { balance:newBal, last_giftcode: Date.now() });
  CURRENT_USER.balance = newBal; CURRENT_USER.last_giftcode = Date.now();
  renderAll();
  showPopup('&#127881; Gift Code Redeemed!', `You received <b style="color:var(--gold-soft);font-size:18px">&#8377;${reward}</b>! Amount credited.`);
}

// ====================== Products ======================
function productCard(p){
  const isFree = p.id==='free';
  return `
    <div class="prod ${isFree?'free':''}">
      <div class="prod-img" style="background:linear-gradient(135deg,${p.color},#000)">${p.name.split(' ')[1]?.[0]||'S'}</div>
      <div class="prod-body">
        <div class="prod-name">${p.name}${isFree?'<span class="tag-free">FREE</span>':''}</div>
        <div class="prod-meta">
          <span>&#128197; ${p.days} days</span>
          <span>&#128176; &#8377;${p.daily}/day</span>
          <span>&#128202; Total &#8377;${p.daily*p.days}</span>
        </div>
      </div>
      <div class="prod-price">
        <div class="price">${p.price===0?'FREE':'&#8377;'+p.price}</div>
        <button onclick="buyProduct('${p.id}')">Buy</button>
      </div>
    </div>`;
}
function renderProducts(){
  document.getElementById('prod-list').innerHTML = PRODUCTS.map(productCard).join('');
}
function renderFeatured(){
  document.getElementById('featured-list').innerHTML = [PRODUCTS[0],PRODUCTS[3],PRODUCTS[5]].map(productCard).join('');
}

async function buyProduct(id){
  const p = PRODUCTS.find(x=>x.id===id);
  if (!p) return;
  const orders = CURRENT_USER.orders || {};
  if (p.id==='free' && Object.values(orders).some(o=>o.product_id==='free')) {
    return showPopup('Already Purchased','You can only purchase the Welcome Free Plan once.');
  }
  if (p.price > (CURRENT_USER.balance||0)) {
    return showPopup('Insufficient Balance', `You need &#8377;${p.price} but have only &#8377;${(CURRENT_USER.balance||0).toFixed(2)}. Please recharge first.`);
  }
  const i = await showPopup(`Confirm Purchase`,
    `<div style="line-height:1.7">
      <p>Plan: <b>${p.name}</b></p>
      <p>Cost: <b style="color:var(--gold-soft)">${p.price===0?'FREE':'&#8377;'+p.price}</b></p>
      <p>Daily Income: <b style="color:var(--gold-soft)">&#8377;${p.daily}</b> for ${p.days} days</p>
      <p>Total Return: <b style="color:var(--gold-soft)">&#8377;${p.daily*p.days}</b></p>
    </div>`,
    [{label:'Cancel'},{label:'Confirm', primary:true}]);
  if (i!==1) return;
  const newBal = (CURRENT_USER.balance||0) - p.price;
  const order = {
    product_id: p.id, name: p.name, price: p.price, days: p.days, daily: p.daily,
    purchased_at: Date.now(), last_claim: 0, claimed_days: 0
  };
  await DB.updateUser(CURRENT_PHONE, { balance: newBal });
  await DB.pushOrder(CURRENT_PHONE, order);
  await loadUser();
  showPopup('&#127881; Purchase Successful!', `<b>${p.name}</b> has been activated. Collect your daily income from <b>My Orders</b>.`);
}

// ====================== Orders ======================
function renderOrders(){
  const orders = CURRENT_USER.orders || {};
  const entries = Object.entries(orders);
  const list = document.getElementById('orders-list');
  if (!entries.length) { list.innerHTML = '<div class="empty">No active investments yet. Buy a plan from the Investment tab!</div>'; return; }
  list.innerHTML = entries.map(([k,o])=>{
    const canClaim = !isSameDay(o.last_claim) && o.claimed_days < o.days;
    const finished = o.claimed_days >= o.days;
    return `<div class="record" style="flex-direction:column;align-items:stretch;gap:8px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700">${o.name}</div>
          <div class="meta">Day ${o.claimed_days}/${o.days} • &#8377;${o.daily}/day</div>
        </div>
        <button onclick="claimOrder('${k}')" ${(!canClaim||finished)?'disabled':''} style="padding:8px 14px;border-radius:8px;background:${(canClaim&&!finished)?'linear-gradient(135deg,var(--gold),#a8821e)':'rgba(255,255,255,.1)'};color:${(canClaim&&!finished)?'#000':'#666'};font-weight:700;font-size:12px;cursor:${(canClaim&&!finished)?'pointer':'not-allowed'}">
          ${finished?'Completed':canClaim?'Collect':'Collected'}
        </button>
      </div>
    </div>`;
  }).join('');
}

async function claimOrder(key){
  const o = CURRENT_USER.orders[key];
  if (!o) return;
  if (isSameDay(o.last_claim)) return showToast('Already claimed today','error');
  if (o.claimed_days >= o.days) return showToast('Plan completed','error');
  const newBal = (CURRENT_USER.balance||0) + o.daily;
  const newInvest = (CURRENT_USER.invest_income||0) + o.daily;
  const newOrder = { ...o, last_claim: Date.now(), claimed_days: o.claimed_days+1 };
  await DB.userRef(CURRENT_PHONE).child('orders').child(key).set(newOrder);
  await DB.updateUser(CURRENT_PHONE, { balance:newBal, invest_income:newInvest });
  await loadUser();
  showPopup('&#128176; Income Collected!', `&#8377;${o.daily} from <b>${o.name}</b> has been credited.`);
}

// ====================== Share / QR ======================
function renderQR(link){
  const box = document.getElementById('qr-box');
  box.innerHTML = '';
  new QRCode(box, { text: link, width:180, height:180, colorDark:'#000', colorLight:'#fff', correctLevel: QRCode.CorrectLevel.H });
}
function copyRefLink(){
  const inp = document.getElementById('ref-link');
  inp.select(); document.execCommand('copy');
  showToast('Referral link copied!','success');
}

// ====================== Mine Menu ======================
const MINE_MENU = [
  { ic:'&#127974;', label:'Bind Bank Account', action:()=>goTab('withdraw') },
  { ic:'&#128221;', label:'Bill Details', action:()=>openBills() },
  { ic:'&#128181;', label:'Recharge Records', action:()=>openRecords('recharge') },
  { ic:'&#128176;', label:'Withdrawal Records', action:()=>openRecords('withdraw') },
  { ic:'&#128101;', label:'My Team', action:()=>goTab('team') },
  { ic:'&#127942;', label:'About Us', action:()=>goTab('about') },
  { ic:'&#128274;', label:'Change Password', action:()=>changePwd() },
  { ic:'&#9432;',  label:'Help Center', action:()=>openHelpCenter() },
  { ic:'&#128682;', label:'Logout', action:()=>doLogout() }
];
function renderMineMenu(){
  document.getElementById('mine-menu').innerHTML = MINE_MENU.map((m,i)=>
    `<div class="menu-item" data-i="${i}"><div class="ic">${m.ic}</div><div class="lbl">${m.label}</div><div class="arrow">&#10095;</div></div>`
  ).join('');
  document.querySelectorAll('#mine-menu .menu-item').forEach(el=>{
    el.onclick = ()=> MINE_MENU[+el.dataset.i].action();
  });
}

function openBills(){
  const orders = Object.values(CURRENT_USER.orders||{});
  const totalInvest = orders.reduce((s,o)=>s+o.price,0);
  const totalRet = (CURRENT_USER.invest_income||0);
  showPopup('Bill Details',
    `<div style="line-height:2;font-size:13px">
      <div style="display:flex;justify-content:space-between"><span>Total Invested</span><b>&#8377;${totalInvest}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Investment Income</span><b style="color:var(--gold-soft)">&#8377;${totalRet.toFixed(2)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Promotion Income</span><b style="color:var(--gold-soft)">&#8377;${(CURRENT_USER.promotion_income||0).toFixed(2)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Total Recharge</span><b>&#8377;${(CURRENT_USER.recharge_total||0).toFixed(2)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Total Withdraw</span><b>&#8377;${(CURRENT_USER.withdraw_total||0).toFixed(2)}</b></div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:8px;margin-top:8px"><span>Wallet Balance</span><b style="color:var(--gold-soft);font-size:16px">&#8377;${(CURRENT_USER.balance||0).toFixed(2)}</b></div>
     </div>`);
}

async function changePwd(){
  const i = await showPopup('Change Password',
    `<input id="cp-old" type="password" placeholder="Current Password" style="width:100%;padding:10px;background:#000;border:1px solid var(--border);border-radius:8px;color:#fff;margin-bottom:8px">
     <input id="cp-new" type="password" placeholder="New Password (min 6)" style="width:100%;padding:10px;background:#000;border:1px solid var(--border);border-radius:8px;color:#fff;margin-bottom:8px">
     <input id="cp-conf" type="password" placeholder="Confirm New Password" style="width:100%;padding:10px;background:#000;border:1px solid var(--border);border-radius:8px;color:#fff">`,
    [{label:'Cancel'},{label:'Update',primary:true}]);
  if (i!==1) return;
  const old=document.getElementById('cp-old').value, np=document.getElementById('cp-new').value, cf=document.getElementById('cp-conf').value;
  if (old !== CURRENT_USER.password) return showToast('Current password wrong','error');
  if (np.length<6) return showToast('Password too short','error');
  if (np!==cf) return showToast('Passwords mismatch','error');
  await DB.updateUser(CURRENT_PHONE, {password: np});
  CURRENT_USER.password = np;
  showToast('Password updated!','success');
}

async function doLogout(){
  const i = await showPopup('Logout?','Are you sure you want to sign out of your account?',[{label:'Cancel'},{label:'Logout',primary:true}]);
  if (i!==1) return;
  Session.clear();
  window.location.href = 'index.html';
}

// ====================== Recharge ======================
let selectedPM = 'upi';
let rechargeTimer = null;
let rechargeAmount = 0;
function openRecharge(){
  goTab('recharge');
  document.getElementById('recharge-step1').style.display='block';
  document.getElementById('recharge-step2').style.display='none';
  document.getElementById('rc-amount').value = '';
  document.getElementById('rc-utr').value = '';
  document.querySelectorAll('.pay-mode .pm').forEach((el,i)=>{
    el.classList.toggle('selected', el.dataset.pm===selectedPM);
    el.onclick = ()=>{ selectedPM = el.dataset.pm; document.querySelectorAll('.pay-mode .pm').forEach(x=>x.classList.toggle('selected', x.dataset.pm===selectedPM)); };
  });
}

function proceedRecharge(){
  const amt = parseFloat(document.getElementById('rc-amount').value);
  if (!amt || amt<100) return showToast('Minimum recharge is ₹100','error');
  if (amt>100000) return showToast('Max recharge ₹1,00,000','error');
  rechargeAmount = amt;
  document.getElementById('rc-display-amt').textContent = amt;
  document.getElementById('recharge-step1').style.display='none';
  document.getElementById('recharge-step2').style.display='block';
  startRechargeTimer();
}

function startRechargeTimer(){
  if (rechargeTimer) clearInterval(rechargeTimer);
  let secs = 600;
  const el = document.getElementById('rc-timer');
  el.textContent = '10:00';
  rechargeTimer = setInterval(()=>{
    secs--;
    if (secs<=0) { clearInterval(rechargeTimer); el.textContent='EXPIRED'; cancelRecharge(); return; }
    const m = String(Math.floor(secs/60)).padStart(2,'0'), s=String(secs%60).padStart(2,'0');
    el.textContent = `${m}:${s}`;
  }, 1000);
}

function copyUPI(){
  const tmp = document.createElement('textarea');
  tmp.value = '6299192385@omni';
  document.body.appendChild(tmp); tmp.select(); document.execCommand('copy'); tmp.remove();
  showToast('UPI ID copied!','success');
}

function cancelRecharge(){
  if (rechargeTimer) clearInterval(rechargeTimer);
  openRecharge();
}

async function submitUTR(){
  const utr = document.getElementById('rc-utr').value.trim();
  if (!/^\d{12}$/.test(utr)) return showToast('UTR must be exactly 12 digits','error');
  const newBal = (CURRENT_USER.balance||0) + rechargeAmount;
  const newRT = (CURRENT_USER.recharge_total||0) + rechargeAmount;
  await DB.updateUser(CURRENT_PHONE, {balance:newBal, recharge_total:newRT});
  await DB.pushRecharge(CURRENT_PHONE, {amount:rechargeAmount, utr, method:selectedPM.toUpperCase(), at:Date.now(), status:'Success'});
  if (rechargeTimer) clearInterval(rechargeTimer);
  await loadUser();
  await showPopup('&#9989; Recharge Successful',`&#8377;${rechargeAmount} has been credited to your wallet.<br>UTR: <b>${utr}</b>`);
  goTab('home');
}

// ====================== Withdraw ======================
function openWithdraw(){
  goTab('withdraw');
  const hasBank = !!CURRENT_USER.bank;
  document.getElementById('wd-bank-section').style.display = hasBank ? 'none' : 'block';
  document.getElementById('wd-form-section').style.display = hasBank ? 'block' : 'none';
  if (hasBank) {
    const b = CURRENT_USER.bank;
    document.getElementById('wd-bank-info').textContent = `${b.name} • ****${b.acc.slice(-4)} • ${b.ifsc}`;
  }
}

async function saveBank(){
  const name = document.getElementById('bk-name').value.trim();
  const acc = document.getElementById('bk-acc').value.trim();
  const ifsc = document.getElementById('bk-ifsc').value.trim().toUpperCase();
  if (!name) return showToast('Enter holder name','error');
  if (!/^\d{9,18}$/.test(acc)) return showToast('Invalid account number','error');
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return showToast('Invalid IFSC code','error');
  await DB.updateUser(CURRENT_PHONE, {bank: {name, acc, ifsc, added:Date.now()}});
  CURRENT_USER.bank = {name, acc, ifsc};
  showPopup('&#9989; Bank Account Added','Your bank account has been linked successfully. You can now request withdrawals.');
  openWithdraw();
}

async function submitWithdraw(){
  const amt = parseFloat(document.getElementById('wd-amount').value);
  if (!amt || amt<200) return showToast('Minimum withdrawal ₹200','error');
  if (amt>50000) return showToast('Max ₹50,000/day','error');
  if (amt > (CURRENT_USER.balance||0)) return showToast('Insufficient balance','error');
  const fee = amt*0.02;
  const net = amt - fee;
  const i = await showPopup('Confirm Withdrawal',
    `<div style="line-height:1.7">
      <div>Request Amount: <b>&#8377;${amt}</b></div>
      <div>Service Fee (2%): <b>&#8377;${fee.toFixed(2)}</b></div>
      <div>You Receive: <b style="color:var(--gold-soft)">&#8377;${net.toFixed(2)}</b></div>
      <div>To: ${CURRENT_USER.bank.name} ****${CURRENT_USER.bank.acc.slice(-4)}</div>
    </div>`,
    [{label:'Cancel'},{label:'Submit',primary:true}]);
  if (i!==1) return;
  const newBal = (CURRENT_USER.balance||0) - amt;
  const newWT = (CURRENT_USER.withdraw_total||0) + amt;
  await DB.updateUser(CURRENT_PHONE, {balance:newBal, withdraw_total:newWT});
  await DB.pushWithdraw(CURRENT_PHONE, {amount:amt, fee, net, bank:CURRENT_USER.bank, at:Date.now(), status:'Pending'});
  await loadUser();
  await showPopup('&#128276; Withdrawal Submitted',
    `Your withdrawal of <b>&#8377;${amt}</b> is being processed. Funds will arrive in your bank within <b>24 hours</b> on business days.<br><br>Request ID: <b>WD${Date.now().toString().slice(-8)}</b>`);
  goTab('mine');
}

// ====================== Records ======================
function openRecords(type){
  goTab('records');
  document.getElementById('records-title').textContent = type==='recharge'?'Recharge Records':'Withdrawal Records';
  const data = type==='recharge' ? CURRENT_USER.recharge_records : CURRENT_USER.withdraw_records;
  const list = document.getElementById('records-list');
  const entries = Object.values(data||{}).sort((a,b)=>b.at-a.at);
  if (!entries.length) { list.innerHTML='<div class="empty">No '+type+' records yet.</div>'; return; }
  list.innerHTML = entries.map(r=>{
    const d = new Date(r.at).toLocaleString('en-IN');
    if (type==='recharge') {
      return `<div class="record"><div><div style="font-weight:700">${r.method} Recharge</div><div class="meta">${d} • UTR: ${r.utr}</div></div><div style="text-align:right"><div class="amt">+&#8377;${r.amount}</div><span class="status">${r.status}</span></div></div>`;
    } else {
      return `<div class="record"><div><div style="font-weight:700">Withdraw to ****${r.bank.acc.slice(-4)}</div><div class="meta">${d} • Fee &#8377;${r.fee.toFixed(2)}</div></div><div style="text-align:right"><div class="amt">-&#8377;${r.amount}</div><span class="status ${r.status==='Pending'?'pending':''}">${r.status}</span></div></div>`;
    }
  }).join('');
}

// ====================== Help Center ======================
function openHelpCenter(){
  showPopup('&#9432; Help Center',
    `<div style="line-height:1.8;font-size:13px">
      <p><b style="color:var(--gold-soft)">&#127873; Gift Codes:</b> Enter any 6-character code to win &#8377;1–&#8377;10, once per day.</p>
      <p><b style="color:var(--gold-soft)">&#127920; Daily Spin:</b> Tap GO on the wheel for &#8377;10–&#8377;40 random reward, once daily.</p>
      <p><b style="color:var(--gold-soft)">&#128181; Investment Plans:</b> Buy a plan, then collect daily income from "My Orders".</p>
      <p><b style="color:var(--gold-soft)">&#128279; Referral:</b> Share your QR or invite code; earn 12% on team recharges.</p>
      <p><b style="color:var(--gold-soft)">&#128176; Recharge:</b> Min &#8377;100. Pay via UPI &rarr; submit 12-digit UTR to credit instantly.</p>
      <p><b style="color:var(--gold-soft)">&#127974; Withdrawal:</b> Min &#8377;200. Add bank, get funds in 24 hrs (business days).</p>
      <hr style="border-color:var(--border);margin:10px 0">
      <p>&#128231; <b>Support:</b> support@scarletcapital.in<br>&#128241; <b>Helpline:</b> +91-1800-419-0033</p>
    </div>`);
}

// ====================== Init ======================
drawWheel();
loadUser().then(()=>welcomePopup());
