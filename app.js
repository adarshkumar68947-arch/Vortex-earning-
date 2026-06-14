/* =========================================================
   VORTEX QUANTUM DIGITAL CAPITAL · APP.JS
   Cloud-bound architecture: Firebase Auth + Firestore
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    addDoc,
    collection,
    serverTimestamp,
    query,
    where,
    getDocs,
    onSnapshot,
    increment
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* Firebase Project Configuration */
const firebaseConfig = {
    apiKey: "AIzaSyCAUQfcd1k63pp2DDyBHWZoD5M-dkiD45",
    authDomain: "scarlet-private-limited.firebaseapp.com",
    databaseURL: "https://scarlet-private-limited-default-rtdb.firebaseio.com",
    projectId: "scarlet-private-limited",
    storageBucket: "scarlet-private-limited.firebasestorage.app",
    messagingSenderId: "570744434725",
    appId: "1:570744434725:web:14b0452a7810806a1ccfcc",
    measurementId: "G-4FZBRZRQBY"
};

/* Firebase Initialization */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* Persistent Login Session */
await setPersistence(auth, browserLocalPersistence);

/* =========================================================
   GLOBAL UTILITIES
   ========================================================= */

/** Convert a 10-digit phone into a synthetic email Firebase Auth accepts */
const phoneToEmail = (phone) => `${phone}@vortexquantum.app`;

/** Friendly INR formatter */
const fmtINR = (v) => {
    const n = Number(v) || 0;
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

/** Premium popup card — replaces all browser alerts */
function showPopup({ type = 'info', title = 'Notice', message = '', confirmText = 'OK', onConfirm, cancelText, onCancel }) {
    const mount = document.getElementById('popupMount');
    if (!mount) return;

    const iconMap = { success: '✓', error: '✕', info: 'i', warn: '!' };
    const wrap = document.createElement('div');
    wrap.className = 'popup-mask';
    wrap.innerHTML = `
        <div class="popup-card">
            <div class="popup-icon ${type}">${iconMap[type] || 'i'}</div>
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="popup-actions">
                ${cancelText ? `<button class="btn-secondary" data-act="cancel">${cancelText}</button>` : ''}
                <button class="btn-primary" data-act="confirm">${confirmText}</button>
            </div>
        </div>
    `;
    mount.appendChild(wrap);

    wrap.addEventListener('click', (e) => {
        if (e.target === wrap) close('cancel');
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'confirm') { close('confirm'); onConfirm?.(); }
        if (act === 'cancel') { close('cancel'); onCancel?.(); }
    });
    function close() { wrap.style.opacity = '0'; setTimeout(() => wrap.remove(), 200); }
}

const setLoading = (on) => {
    const el = document.getElementById('loaderMount');
    if (el) el.hidden = !on;
};

/** Map any Firebase auth error to a friendly english message */
function authErrorMessage(err) {
    const code = err?.code || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'The phone number and password do not match. Please verify and try again.';
    if (code.includes('user-not-found')) return 'No account exists for that phone number. Please register first.';
    if (code.includes('email-already-in-use')) return 'An account is already registered for this phone number. Please log in instead.';
    if (code.includes('weak-password')) return 'Password is too weak. Please use at least 6 characters.';
    if (code.includes('too-many-requests')) return 'Too many failed attempts. Please pause briefly and try again.';
    if (code.includes('network-request-failed')) return 'Network connection lost. Please verify your internet and retry.';
    return err?.message || 'Unexpected authentication failure. Please try again.';
}

/** Build a new user document blueprint */
function newUserDoc(phone, referrer = '') {
    return {
        phone,
        referrer: referrer || '',
        balance: 0,
        promotion: 0,
        totalYield: 0,
        totalInvested: 0,
        activeOrders: [],
        lastSpinAt: null,
        lastHarvestAt: null,
        bank: { name: '', account: '', ifsc: '' },
        createdAt: serverTimestamp()
    };
}

/* =========================================================
   CAPTCHA + HELP WIDGET (shared across pages)
   ========================================================= */
const CAPTCHA_STATE = {};
function buildCaptcha(id) {
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
    CAPTCHA_STATE[id] = a + b;
    const el = document.getElementById(`${id}CaptchaText`);
    if (el) el.textContent = `${a} + ${b} = ?`;
}
function verifyCaptcha(id, value) {
    return Number(value) === CAPTCHA_STATE[id];
}

const HELP_LOCATIONS = [
    { city: 'Mumbai HQ', addr: 'Level 24, World Trade Centre, Cuffe Parade, Mumbai 400005, IN', reg: 'CIN: U67100MH2022PTC379455' },
    { city: 'Bangalore Quant Lab', addr: 'Prestige Trade Tower, Palace Road, Bengaluru 560001, KA, IN', reg: 'CIN: U67100KA2023PTC181229' },
    { city: 'Delhi Liquidity Desk', addr: 'World Trade Tower, Sector 16, Noida 201301, UP, IN', reg: 'CIN: U67100UP2023PTC174403' },
    { city: 'Singapore Routing', addr: '8 Marina View, Asia Square Tower 1, #34-01, Singapore 018960', reg: 'UEN: 202214783E' },
    { city: 'Dubai DIFC Office', addr: 'Index Tower, Level 27, DIFC, Dubai, UAE', reg: 'DIFC No: 4716' }
];

function mountHelpWidget() {
    const fab = document.getElementById('helpFab');
    const win = document.getElementById('helpWindow');
    const close = document.getElementById('helpClose');
    if (!fab) return;

    const pick = HELP_LOCATIONS[Math.floor(Math.random() * HELP_LOCATIONS.length)];
    const addrEl = document.getElementById('helpAddress');
    const regEl = document.getElementById('helpRegNo');
    if (addrEl) addrEl.textContent = `${pick.city} · ${pick.addr}`;
    if (regEl) regEl.textContent = pick.reg;

    fab.addEventListener('click', () => { win.hidden = !win.hidden; });
    close?.addEventListener('click', () => { win.hidden = true; });
}

/* Help link on dashboard re-uses help-window pattern */
function mountDashHelp() {
    const link = document.getElementById('dashHelpLink');
    if (!link) return;
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pick = HELP_LOCATIONS[Math.floor(Math.random() * HELP_LOCATIONS.length)];
        showPopup({
            type: 'info',
            title: 'Vortex Support Desk',
            message: `${pick.city}\n${pick.addr}\n${pick.reg}\nsupport@vortexquantum.io`,
            confirmText: 'Acknowledge'
        });
    });
}

/* =========================================================
   PRODUCT CATALOG
   ========================================================= */
const PRODUCTS = [
    { id: 'P0', name: 'Free Trial Cluster', tier: 'free',     price: 0,    days: 3,  daily: 50,   tag: 'Trial' },
    { id: 'P1', name: 'Vortex Starter',     tier: 'standard', price: 500,  days: 30, daily: 80,   tag: 'Entry' },
    { id: 'P2', name: 'Quantum Pulse',      tier: 'standard', price: 1500, days: 35, daily: 250,  tag: 'Pulse' },
    { id: 'P3', name: 'Liquidity Engine',   tier: 'standard', price: 3000, days: 40, daily: 520,  tag: 'Engine' },
    { id: 'P4', name: 'Arbitrage Stream',   tier: 'pro',      price: 6000, days: 45, daily: 1100, tag: 'Pro' },
    { id: 'P5', name: 'Neural Yield Vault', tier: 'pro',      price: 12000,days: 50, daily: 2300, tag: 'Pro' },
    { id: 'P6', name: 'Hyper-Hash Tier',    tier: 'pro',      price: 25000,days: 55, daily: 4900, tag: 'Pro' },
    { id: 'P7', name: 'Sovereign Reserve',  tier: 'gold',     price: 50000,days: 60, daily: 10500,tag: 'Gold' },
    { id: 'P8', name: 'Apex Quant Matrix',  tier: 'gold',     price: 100000,days: 70,daily: 22500,tag: 'Gold' },
    { id: 'P9', name: 'Vortex Sovereign X', tier: 'gold',     price: 200000,days: 90,daily: 48000,tag: 'Gold' }
];

/* =========================================================
   AUTH PAGE LOGIC (index.html)
   ========================================================= */
function bootAuthPage() {
    mountHelpWidget();

    // tabs
    const tabs = document.querySelectorAll('.auth-tab');
    const slider = document.getElementById('tabSlider');
    const panels = {
        login: document.getElementById('loginPanel'),
        register: document.getElementById('registerPanel'),
        forgot: document.getElementById('forgotPanel')
    };
    const idxMap = { login: 0, register: 1, forgot: 2 };

    const activateTab = (key) => {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === key));
        Object.entries(panels).forEach(([k, el]) => el.classList.toggle('active', k === key));
        if (slider) slider.style.transform = `translateX(${idxMap[key] * 100}%)`;
        buildCaptcha(key);
    };
    tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));
    activateTab('login');

    // session redirect: if already authenticated, send to dashboard
    onAuthStateChanged(auth, (user) => {
        if (user && location.pathname.endsWith('index.html') || (user && location.pathname.endsWith('/'))) {
            location.replace('dashboard.html');
        }
    });

    // LOGIN handler
    panels.login.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('loginPhone').value.trim();
        const pwd = document.getElementById('loginPassword').value;
        const cap = document.getElementById('loginCaptcha').value;

        if (!/^[6-9]\d{9}$/.test(phone)) return showPopup({ type: 'error', title: 'Invalid Phone', message: 'Enter a valid 10-digit Indian mobile number (starting 6-9).' });
        if (!verifyCaptcha('login', cap)) { buildCaptcha('login'); return showPopup({ type: 'error', title: 'Captcha Mismatch', message: 'The verification puzzle answer is incorrect. A new puzzle has been generated.' }); }

        try {
            setLoading(true);
            await signInWithEmailAndPassword(auth, phoneToEmail(phone), pwd);
            // ensure profile doc exists
            const ref = doc(db, 'users', phoneToEmail(phone));
            const snap = await getDoc(ref);
            if (!snap.exists()) await setDoc(ref, newUserDoc(phone));
            setLoading(false);
            location.replace('dashboard.html');
        } catch (err) {
            setLoading(false);
            buildCaptcha('login');
            showPopup({ type: 'error', title: 'Login Failed', message: authErrorMessage(err) });
        }
    });

    // REGISTER handler
    panels.register.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('regPhone').value.trim();
        const pwd = document.getElementById('regPassword').value;
        const ref = document.getElementById('regReferral').value.trim();
        const cap = document.getElementById('regCaptcha').value;

        if (!/^[6-9]\d{9}$/.test(phone)) return showPopup({ type: 'error', title: 'Invalid Phone', message: 'Enter a valid 10-digit Indian mobile number (starting 6-9).' });
        if (pwd.length < 6) return showPopup({ type: 'error', title: 'Weak Password', message: 'Password must be at least 6 characters long.' });
        if (!verifyCaptcha('register', cap)) { buildCaptcha('register'); return showPopup({ type: 'error', title: 'Captcha Mismatch', message: 'The verification puzzle answer is incorrect. A new puzzle has been generated.' }); }

        try {
            setLoading(true);
            await createUserWithEmailAndPassword(auth, phoneToEmail(phone), pwd);
            const userRef = doc(db, 'users', phoneToEmail(phone));
            await setDoc(userRef, newUserDoc(phone, ref));
            await addDoc(collection(db, 'ledger'), {
                uid: phoneToEmail(phone), phone, type: 'signup', amount: 0,
                note: 'Vault identity provisioned', createdAt: serverTimestamp()
            });
            setLoading(false);
            showPopup({
                type: 'success', title: 'Vault Activated',
                message: 'Your global cloud-bound identity has been provisioned. Entering Asset Command Center…',
                confirmText: 'Proceed',
                onConfirm: () => location.replace('dashboard.html')
            });
        } catch (err) {
            setLoading(false);
            buildCaptcha('register');
            showPopup({ type: 'error', title: 'Registration Failed', message: authErrorMessage(err) });
        }
    });

    // FORGOT handler (lightweight stub — files a recovery request to Firestore)
    panels.forgot.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('forgotPhone').value.trim();
        const newPwd = document.getElementById('forgotPassword').value;
        const cap = document.getElementById('forgotCaptcha').value;

        if (!/^[6-9]\d{9}$/.test(phone)) return showPopup({ type: 'error', title: 'Invalid Phone', message: 'Enter a valid 10-digit Indian mobile number.' });
        if (newPwd.length < 6) return showPopup({ type: 'error', title: 'Weak Password', message: 'New password must be at least 6 characters long.' });
        if (!verifyCaptcha('forgot', cap)) { buildCaptcha('forgot'); return showPopup({ type: 'error', title: 'Captcha Mismatch', message: 'Verification puzzle is incorrect.' }); }

        try {
            setLoading(true);
            await addDoc(collection(db, 'recoveryRequests'), {
                phone, requestedAt: serverTimestamp(), status: 'pending'
            });
            setLoading(false);
            showPopup({
                type: 'success', title: 'Recovery Filed',
                message: 'A compliance ticket has been logged. Our security desk will contact you on the registered phone within 24 working hours.',
                confirmText: 'Acknowledge'
            });
        } catch (err) {
            setLoading(false);
            showPopup({ type: 'error', title: 'Recovery Failed', message: err.message });
        }
    });
}

/* =========================================================
   DASHBOARD BOOT
   ========================================================= */
let CURRENT_USER = null;
let USER_REF = null;
let USER_DATA = null;
let UNSUB_USER = null;

function bootDashboard() {
    mountDashHelp();

    onAuthStateChanged(auth, async (user) => {
        if (!user) { location.replace('index.html'); return; }
        CURRENT_USER = user;
        USER_REF = doc(db, 'users', user.email);

        // Ensure profile doc exists
        const snap = await getDoc(USER_REF);
        if (!snap.exists()) {
            const phone = user.email.split('@')[0];
            await setDoc(USER_REF, newUserDoc(phone));
        }

        // Real-time profile sync across devices
        if (UNSUB_USER) UNSUB_USER();
        UNSUB_USER = onSnapshot(USER_REF, (docSnap) => {
            if (!docSnap.exists()) return;
            USER_DATA = docSnap.data();
            renderUserSurfaces();
        });

        // top bar identity
        const phoneTxt = `+91 ${user.email.split('@')[0]}`;
        document.getElementById('userIdChip').textContent = phoneTxt;
        document.getElementById('mineUserId').textContent = phoneTxt;

        // bottom dock nav
        document.querySelectorAll('.dock-btn').forEach(btn => {
            btn.addEventListener('click', () => switchView(btn.dataset.view));
        });

        // welcome overlay (show once per session)
        const welcomeShown = sessionStorage.getItem('vortexWelcome');
        const overlay = document.getElementById('welcomeOverlay');
        if (welcomeShown) overlay.classList.add('hidden');
        document.getElementById('welcomeClose').addEventListener('click', (e) => {
            e.preventDefault();
            overlay.classList.add('hidden');
            sessionStorage.setItem('vortexWelcome', '1');
        });

        // Initialise modules
        mountHomeModule();
        mountIncomeModule();
        mountSpinModule();
        mountShareModule();
        mountMineModule();
    });
}

function switchView(name) {
    document.querySelectorAll('.dock-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.querySelectorAll('.panel-view').forEach(p => p.classList.toggle('active', p.dataset.view === name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Re-render all places that show wallet / balance / metrics */
function renderUserSurfaces() {
    if (!USER_DATA) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('homeBalance', fmtINR(USER_DATA.balance));
    set('homeInvested', '₹' + fmtINR(USER_DATA.totalInvested));
    set('homeEarned', '₹' + fmtINR(USER_DATA.totalYield));
    set('homeActive', (USER_DATA.activeOrders || []).filter(o => o.active).length);

    set('mineBalance', fmtINR(USER_DATA.balance));
    set('minePromotion', fmtINR(USER_DATA.promotion));
    set('mineYield', fmtINR(USER_DATA.totalYield));

    renderOrderList();
    refreshShareLinks();
    refreshSpinStatus();
    refreshHarvestStatus();
}

/* =========================================================
   DASHBOARD MODULES
   ========================================================= */

/* ---------- HOME: gift code redemption ---------- */
function mountHomeModule() {
    const form = document.getElementById('giftForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('giftInput');
        const code = (input.value || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(code)) {
            return showPopup({ type: 'error', title: 'Invalid Cipher', message: 'Gift code must be exactly 6 alphanumeric characters.' });
        }

        try {
            setLoading(true);
            // Query Firestore to see if cipher was already redeemed by this user
            const redeemRef = collection(db, 'giftRedemptions');
            const q = query(redeemRef, where('uid', '==', CURRENT_USER.email), where('code', '==', code));
            const dup = await getDocs(q);
            if (!dup.empty) {
                setLoading(false);
                return showPopup({ type: 'error', title: 'Cipher Exhausted', message: 'This cipher has already been redeemed on your account.' });
            }

            const credits = [10, 20, 50];
            const credit = credits[Math.floor(Math.random() * credits.length)];

            await updateDoc(USER_REF, { balance: increment(credit) });
            await addDoc(redeemRef, {
                uid: CURRENT_USER.email, phone: USER_DATA.phone, code, amount: credit, createdAt: serverTimestamp()
            });
            await addDoc(collection(db, 'ledger'), {
                uid: CURRENT_USER.email, phone: USER_DATA.phone, type: 'gift',
                amount: credit, sign: '+', note: `Gift cipher ${code} redeemed`, createdAt: serverTimestamp()
            });

            setLoading(false);
            input.value = '';
            showPopup({ type: 'success', title: 'Cipher Redeemed', message: `₹${credit} credit token injected into your cloud wallet.` });
        } catch (err) {
            setLoading(false);
            showPopup({ type: 'error', title: 'Redemption Failed', message: err.message });
        }
    });
}

/* ---------- INCOME: products + harvest ---------- */
function mountIncomeModule() {
    // segment tabs
    document.querySelectorAll('#view-income .seg-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#view-income .seg-tab').forEach(t => t.classList.toggle('active', t === tab));
            document.querySelectorAll('#view-income .seg-view').forEach(v => v.classList.toggle('active', v.id === `seg-${tab.dataset.seg}`));
        });
    });

    // render product grid
    const grid = document.getElementById('productGrid');
    grid.innerHTML = PRODUCTS.map(p => `
        <div class="product-card ${p.tier === 'free' ? 'free' : (p.tier === 'gold' ? 'gold' : '')}">
            <div class="product-icon">${p.tier === 'gold' ? '★' : (p.tier === 'free' ? '✦' : '◈')}</div>
            <div class="product-info">
                <h4>${p.name} <small style="color:var(--text-mute);font-weight:500">· ${p.tag}</small></h4>
                <p>Price <strong>₹${p.price}</strong> · Daily <strong>₹${p.daily}</strong> · ${p.days} days</p>
            </div>
            <button class="product-buy" data-pid="${p.id}">${p.price === 0 ? 'CLAIM' : 'BUY'}</button>
        </div>
    `).join('');

    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pid]');
        if (!btn) return;
        const product = PRODUCTS.find(x => x.id === btn.dataset.pid);
        if (!product) return;
        confirmPurchase(product);
    });

    // harvest button
    document.getElementById('harvestBtn').addEventListener('click', harvestDividends);
}

function confirmPurchase(product) {
    const msg = product.price === 0
        ? `Activate the Free Trial Cluster for ${product.days} days at ₹${product.daily} per day?`
        : `Allocate ₹${product.price} from your wallet to activate ${product.name}? Plan runs for ${product.days} days at ₹${product.daily} daily yield.`;

    showPopup({
        type: 'info', title: product.name, message: msg,
        confirmText: 'Activate', cancelText: 'Cancel',
        onConfirm: () => executePurchase(product)
    });
}

async function executePurchase(product) {
    if (product.price > 0 && (USER_DATA.balance || 0) < product.price) {
        return showPopup({ type: 'error', title: 'Insufficient Balance', message: 'Please recharge your wallet to activate this cluster.' });
    }
    // Free trial only allowed once
    if (product.price === 0) {
        const claimed = (USER_DATA.activeOrders || []).some(o => o.pid === product.id);
        if (claimed) return showPopup({ type: 'error', title: 'Already Claimed', message: 'Your free trial cluster has already been activated.' });
    }

    try {
        setLoading(true);
        const now = Date.now();
        const order = {
            pid: product.id, name: product.name, price: product.price, daily: product.daily,
            days: product.days, startAt: now, endAt: now + product.days * 86400000,
            lastClaimAt: 0, active: true
        };
        const newOrders = [...(USER_DATA.activeOrders || []), order];
        const updates = { activeOrders: newOrders };
        if (product.price > 0) {
            updates.balance = increment(-product.price);
            updates.totalInvested = increment(product.price);
        }
        await updateDoc(USER_REF, updates);
        await addDoc(collection(db, 'ledger'), {
            uid: CURRENT_USER.email, phone: USER_DATA.phone, type: 'purchase',
            amount: product.price, sign: '-', note: `Activated ${product.name}`, createdAt: serverTimestamp()
        });
        setLoading(false);
        showPopup({ type: 'success', title: 'Cluster Activated', message: `${product.name} is now mining yield. Harvest dividends from the Income · Device Order Lists panel.` });
    } catch (err) {
        setLoading(false);
        showPopup({ type: 'error', title: 'Activation Failed', message: err.message });
    }
}

function renderOrderList() {
    const list = document.getElementById('orderList');
    if (!list || !USER_DATA) return;
    const orders = (USER_DATA.activeOrders || []);
    if (!orders.length) {
        list.innerHTML = `<div class="empty-state">No active investment clusters yet. Visit the Investment Clusters tab to allocate capital.</div>`;
        return;
    }
    list.innerHTML = orders.map((o, i) => {
        const active = o.active && Date.now() < o.endAt;
        const remDays = Math.max(0, Math.ceil((o.endAt - Date.now()) / 86400000));
        return `
        <div class="order-row">
            <div>
                <h5>${o.name}</h5>
                <small>Daily ₹${o.daily} · ${remDays} day(s) remaining · ${active ? 'ACTIVE' : 'COMPLETED'}</small>
            </div>
            <div class="order-amt">+₹${o.daily}<small>/day</small></div>
        </div>`;
    }).join('');
}

function refreshHarvestStatus() {
    const status = document.getElementById('harvestStatus');
    const btn = document.getElementById('harvestBtn');
    if (!status || !btn || !USER_DATA) return;
    const last = USER_DATA.lastHarvestAt?.toMillis ? USER_DATA.lastHarvestAt.toMillis() : (USER_DATA.lastHarvestAt || 0);
    const elapsed = Date.now() - last;
    if (elapsed < 86400000) {
        const remH = Math.ceil((86400000 - elapsed) / 3600000);
        status.textContent = `Next harvest available in ~${remH} hour(s)`;
        btn.disabled = true;
    } else {
        status.textContent = 'Status: Ready · Harvest window is open';
        btn.disabled = false;
    }
}

async function harvestDividends() {
    const orders = (USER_DATA.activeOrders || []).filter(o => o.active && Date.now() < o.endAt);
    if (!orders.length) return showPopup({ type: 'error', title: 'Nothing to Harvest', message: 'You have no active investment clusters. Activate a cluster first.' });
    const last = USER_DATA.lastHarvestAt?.toMillis ? USER_DATA.lastHarvestAt.toMillis() : (USER_DATA.lastHarvestAt || 0);
    if (Date.now() - last < 86400000) return showPopup({ type: 'error', title: 'Cooldown Active', message: 'Daily harvest can only be executed once every 24 hours.' });

    const total = orders.reduce((s, o) => s + Number(o.daily || 0), 0);

    try {
        setLoading(true);
        await updateDoc(USER_REF, {
            balance: increment(total),
            totalYield: increment(total),
            lastHarvestAt: serverTimestamp()
        });
        await addDoc(collection(db, 'ledger'), {
            uid: CURRENT_USER.email, phone: USER_DATA.phone, type: 'harvest',
            amount: total, sign: '+', note: `Daily dividend harvest across ${orders.length} cluster(s)`, createdAt: serverTimestamp()
        });
        setLoading(false);
        showPopup({ type: 'success', title: 'Dividends Harvested', message: `₹${fmtINR(total)} aggregated and routed to your cloud wallet.` });
    } catch (err) {
        setLoading(false);
        showPopup({ type: 'error', title: 'Harvest Failed', message: err.message });
    }
}

/* ---------- SPIN MODULE ---------- */
const SPIN_REWARDS = [10, 20, 100, 300, 500, 1500];

function mountSpinModule() {
    const wheel = document.getElementById('spinWheel');
    if (!wheel) return;

    // Add reward labels overlay
    const labels = document.createElement('div');
    labels.className = 'wheel-labels';
    SPIN_REWARDS.forEach((r, i) => {
        const span = document.createElement('span');
        const angle = (i * 60) + 30;
        span.textContent = `₹${r}`;
        span.style.transform = `translateX(-50%) rotate(${angle}deg)`;
        labels.appendChild(span);
    });
    wheel.appendChild(labels);

    document.getElementById('spinGo').addEventListener('click', executeSpin);
}

function refreshSpinStatus() {
    const status = document.getElementById('spinStatus');
    const btn = document.getElementById('spinGo');
    if (!status || !btn || !USER_DATA) return;
    const last = USER_DATA.lastSpinAt?.toMillis ? USER_DATA.lastSpinAt.toMillis() : (USER_DATA.lastSpinAt || 0);
    const elapsed = Date.now() - last;
    if (elapsed < 86400000) {
        const remH = Math.ceil((86400000 - elapsed) / 3600000);
        status.textContent = `Next spin available in ~${remH} hour(s)`;
        btn.disabled = true;
    } else {
        status.textContent = 'Ready to spin';
        btn.disabled = false;
    }
}

async function executeSpin() {
    const last = USER_DATA.lastSpinAt?.toMillis ? USER_DATA.lastSpinAt.toMillis() : (USER_DATA.lastSpinAt || 0);
    if (Date.now() - last < 86400000) {
        return showPopup({ type: 'error', title: 'Cooldown Active', message: 'The reward spinner can be executed exactly once every 24 hours.' });
    }

    const idx = Math.floor(Math.random() * SPIN_REWARDS.length);
    const reward = SPIN_REWARDS[idx];
    const wheel = document.getElementById('spinWheel');
    const btn = document.getElementById('spinGo');
    btn.disabled = true;

    // rotate wheel: 6 full turns + alignment to chosen slot
    const segAngle = 60;
    const targetAngle = 360 * 6 + (360 - (idx * segAngle + segAngle / 2));
    wheel.style.transform = `rotate(${targetAngle}deg)`;

    setTimeout(async () => {
        try {
            await updateDoc(USER_REF, {
                balance: increment(reward),
                lastSpinAt: serverTimestamp()
            });
            await addDoc(collection(db, 'ledger'), {
                uid: CURRENT_USER.email, phone: USER_DATA.phone, type: 'spin',
                amount: reward, sign: '+', note: `Quantum spinner reward ₹${reward}`, createdAt: serverTimestamp()
            });
            showPopup({
                type: 'success', title: `You Won ₹${reward}!`,
                message: `The quantum spinner has credited ₹${reward} to your primary cloud wallet. Comprehensive ledger entry has been committed. Return tomorrow for the next spin cycle.`
            });
        } catch (err) {
            showPopup({ type: 'error', title: 'Reward Sync Failed', message: err.message });
        }
    }, 4100);
}

/* ---------- SHARE MODULE ---------- */
function mountShareModule() {
    const copyBtn = document.getElementById('copyRefBtn');
    if (!copyBtn) return;
    copyBtn.addEventListener('click', () => {
        const input = document.getElementById('refLink');
        input.select();
        document.execCommand('copy');
        navigator.clipboard?.writeText(input.value).catch(() => {});
        showPopup({ type: 'success', title: 'URL Copied', message: 'Share the link with your network to grow your downstream cluster.' });
    });
}

function refreshShareLinks() {
    if (!USER_DATA) return;
    const link = `${location.origin}${location.pathname.replace('dashboard.html','index.html')}?ref=${encodeURIComponent(USER_DATA.phone)}`;
    const input = document.getElementById('refLink');
    if (input) input.value = link;
    const qr = document.getElementById('qrFrame');
    if (qr) {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(link)}`;
        qr.innerHTML = `<img src="${url}" alt="Referral QR" />`;
    }
}

/* ---------- MINE MODULE ---------- */
function mountMineModule() {
    document.getElementById('openRecharge')?.addEventListener('click', openRechargeModal);
    document.getElementById('openWithdraw')?.addEventListener('click', openWithdrawModal);
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        showPopup({
            type: 'info', title: 'Sign Out', message: 'Terminate this session and return to the secure gateway?',
            confirmText: 'Sign Out', cancelText: 'Stay',
            onConfirm: async () => {
                if (UNSUB_USER) UNSUB_USER();
                await signOut(auth);
                location.replace('index.html');
            }
        });
    });

    document.querySelectorAll('.setting-row[data-modal]').forEach(row => {
        row.addEventListener('click', (e) => {
            e.preventDefault();
            openSettingsModal(row.dataset.modal);
        });
    });
}

/* ---------- GENERIC MODAL SHEET ---------- */
function openSheet(title, bodyHTML) {
    const mount = document.getElementById('modalMount');
    mount.innerHTML = `
        <div class="modal-mask"></div>
        <div class="modal-sheet">
            <div class="modal-head">
                <h3>${title}</h3>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">${bodyHTML}</div>
        </div>
    `;
    const close = () => mount.innerHTML = '';
    mount.querySelector('.modal-mask').addEventListener('click', close);
    mount.querySelector('.modal-close').addEventListener('click', close);
    return { mount, close };
}

/* ---------- RECHARGE ---------- */
const PAY_CHANNELS = [
    { id: 'upi-1', name: 'UPI · Quantum Gateway', tag: 'Instant · 0% fee' },
    { id: 'upi-2', name: 'UPI · Vortex Route', tag: 'Instant · 0% fee' },
    { id: 'upi-3', name: 'UPI · Liquidity Rail', tag: 'Instant · 0% fee' }
];

function openRechargeModal() {
    const channelsHTML = PAY_CHANNELS.map((c, i) => `
        <div class="pay-channel ${i === 0 ? 'selected' : ''}" data-cid="${c.id}">
            <div class="pay-channel-ico">${c.name[6]}</div>
            <div class="pay-channel-info"><strong>${c.name}</strong><small>${c.tag}</small></div>
            <div class="pay-channel-check"></div>
        </div>`).join('');

    const html = `
        <p class="block-sub">Inject capital into your cloud wallet. Minimum recharge is <strong style="color:var(--accent-3)">₹500</strong>. All deposits are confirmed via UTR.</p>
        <div class="pay-channels" id="payChannels">${channelsHTML}</div>
        <label class="field">
            <span class="field-label">Recharge Amount (INR)</span>
            <input type="number" id="rechargeAmt" placeholder="Minimum ₹500" min="500" />
        </label>
        <button class="primary-btn" id="rechargeNext"><span>Proceed to Invoice</span></button>
    `;
    const { mount, close } = openSheet('📥 Recharge Wallet', html);

    mount.querySelectorAll('.pay-channel').forEach(ch => {
        ch.addEventListener('click', () => {
            mount.querySelectorAll('.pay-channel').forEach(x => x.classList.remove('selected'));
            ch.classList.add('selected');
        });
    });

    mount.querySelector('#rechargeNext').addEventListener('click', () => {
        const amt = Number(mount.querySelector('#rechargeAmt').value);
        const cid = mount.querySelector('.pay-channel.selected')?.dataset.cid || 'upi-1';
        if (!amt || amt < 500) return showPopup({ type: 'error', title: 'Amount Too Low', message: 'Minimum recharge amount is ₹500.' });
        renderInvoiceFrame(amt, cid, close);
    });
}

function renderInvoiceFrame(amount, channelId, closeParent) {
    const upi = '6299192385@omni';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(`upi://pay?pa=${upi}&pn=VortexQuantum&am=${amount}&cu=INR`)}`;
    const html = `
        <div class="invoice-frame">
            <div class="invoice-qr"><img src="${qrUrl}" alt="UPI QR"/></div>
            <p class="block-sub">Scan the QR with any UPI app or pay directly to the gateway address below.</p>
            <div class="upi-row">
                <code id="upiText">${upi}</code>
                <button id="copyUpi">COPY</button>
            </div>
            <div class="timer-chip" id="invoiceTimer">10:00 left</div>
            <label class="field">
                <span class="field-label">12-Digit UTR Confirmation</span>
                <input type="text" id="utrInput" maxlength="12" placeholder="Enter UTR after payment" />
            </label>
            <p class="note-info">After payment, paste the 12-digit UTR reference from your UPI app and submit. Our reconciliation engine credits verified deposits to your wallet within institutional settlement windows.</p>
            <button class="primary-btn" id="utrSubmit"><span>Submit UTR &amp; Notify Desk</span></button>
        </div>
    `;
    const { mount, close } = openSheet(`Invoice · ₹${amount}`, html);

    // copy upi
    mount.querySelector('#copyUpi').addEventListener('click', () => {
        navigator.clipboard?.writeText(upi);
        showPopup({ type: 'success', title: 'UPI Copied', message: 'Gateway address copied to clipboard.' });
    });

    // 10-min countdown
    let remaining = 600;
    const timerEl = mount.querySelector('#invoiceTimer');
    const ticker = setInterval(() => {
        remaining--;
        if (remaining <= 0) { clearInterval(ticker); timerEl.textContent = 'SESSION EXPIRED'; return; }
        const m = String(Math.floor(remaining / 60)).padStart(2, '0');
        const s = String(remaining % 60).padStart(2, '0');
        timerEl.textContent = `${m}:${s} left`;
    }, 1000);

    mount.querySelector('#utrSubmit').addEventListener('click', async () => {
        const utr = mount.querySelector('#utrInput').value.trim();
        if (!/^\d{12}$/.test(utr)) return showPopup({ type: 'error', title: 'Invalid UTR', message: 'UTR must be exactly 12 digits.' });
        try {
            setLoading(true);
            await addDoc(collection(db, 'rechargeRecords'), {
                uid: CURRENT_USER.email, phone: USER_DATA.phone,
                amount, utr, channel: channelId, status: 'pending', upi,
                createdAt: serverTimestamp()
            });
            await addDoc(collection(db, 'ledger'), {
                uid: CURRENT_USER.email, phone: USER_DATA.phone, type: 'recharge-pending',
                amount, sign: '+', note: `Recharge submitted · UTR ${utr}`, createdAt: serverTimestamp()
            });
            clearInterval(ticker);
            setLoading(false);
            close(); closeParent && closeParent();
            showPopup({ type: 'success', title: 'Invoice Submitted', message: 'Your UTR has been logged. Funds will reflect in your wallet after reconciliation.' });
        } catch (err) {
            setLoading(false);
            showPopup({ type: 'error', title: 'Submission Failed', message: err.message });
        }
    });
}

/* ---------- WITHDRAW ---------- */
function openWithdrawModal() {
    const bank = USER_DATA.bank || { name: '', account: '', ifsc: '' };
    const hasBank = bank.name && bank.account && bank.ifsc;

    if (!hasBank) {
        return openSettingsModal('bankBind', () => {
            showPopup({ type: 'info', title: 'Bind Bank First', message: 'Please save your bank endpoint, then re-open the withdrawal panel.' });
        });
    }

    const html = `
        <p class="block-sub">Cash-out funds to your bound bank endpoint. Minimum withdrawal <strong style="color:var(--accent-3)">₹200</strong>.</p>
        <div class="note-info">
            <strong>Bound Endpoint</strong><br/>
            ${bank.name}<br/>
            ${bank.account} · ${bank.ifsc}
        </div>
        <label class="field">
            <span class="field-label">Withdrawal Amount (INR)</span>
            <input type="number" id="wAmount" placeholder="Minimum ₹200" min="200"/>
        </label>
        <p class="note-info">Processing window: settlements are routed through institutional banking rails within 24-72 hours. A 5% processing reserve is held until clearance.</p>
        <button class="primary-btn" id="wSubmit"><span>Submit Withdrawal Request</span></button>
    `;
    const { mount, close } = openSheet('🏦 Withdraw Funds', html);

    mount.querySelector('#wSubmit').addEventListener('click', async () => {
        const amt = Number(mount.querySelector('#wAmount').value);
        if (!amt || amt < 200) return showPopup({ type: 'error', title: 'Amount Too Low', message: 'Minimum withdrawal amount is ₹200.' });
        if (amt > (USER_DATA.balance || 0)) return showPopup({ type: 'error', title: 'Insufficient Balance', message: 'Withdrawal exceeds your wallet balance.' });

        try {
            setLoading(true);
            await addDoc(collection(db, 'withdrawRecords'), {
                uid: CURRENT_USER.email, phone: USER_DATA.phone, amount: amt, bank,
                status: 'pending', createdAt: serverTimestamp()
            });
            await updateDoc(USER_REF, { balance: increment(-amt) });
            await addDoc(collection(db, 'ledger'), {
                uid: CURRENT_USER.email, phone: USER_DATA.phone, type: 'withdraw',
                amount: amt, sign: '-', note: `Withdrawal request to ${bank.account}`, createdAt: serverTimestamp()
            });
            setLoading(false);
            close();
            showPopup({ type: 'success', title: 'Withdrawal Filed', message: `₹${fmtINR(amt)} pending settlement to ${bank.account}. Track status in Withdrawal Records.` });
        } catch (err) {
            setLoading(false);
            showPopup({ type: 'error', title: 'Withdraw Failed', message: err.message });
        }
    });
}

/* ---------- SETTINGS MODALS ---------- */
async function openSettingsModal(kind, onClose) {
    if (kind === 'bankBind') return openBankBind(onClose);
    if (kind === 'about') return openAbout();
    if (kind === 'bill') return openLedger();
    if (kind === 'rechargeLog') return openRechargeLog();
    if (kind === 'withdrawLog') return openWithdrawLog();
    if (kind === 'team') return openTeam();
}

function openBankBind(onClose) {
    const bank = USER_DATA.bank || { name: '', account: '', ifsc: '' };
    const html = `
        <p class="block-sub">Bind a bank endpoint to enable withdrawals. This profile is encrypted on the global Firestore ledger.</p>
        <label class="field"><span class="field-label">Account Holder Name</span><input type="text" id="bName" value="${bank.name}" placeholder="As per bank records"/></label>
        <label class="field"><span class="field-label">Bank Account Number</span><input type="text" id="bAcc" value="${bank.account}" placeholder="Account number"/></label>
        <label class="field"><span class="field-label">IFSC Code</span><input type="text" id="bIfsc" value="${bank.ifsc}" placeholder="IFSC"/></label>
        <button class="primary-btn" id="bSave"><span>Save Endpoint</span></button>
    `;
    const { mount, close } = openSheet('🏛 Bind Bank Account', html);
    mount.querySelector('#bSave').addEventListener('click', async () => {
        const name = mount.querySelector('#bName').value.trim();
        const acc = mount.querySelector('#bAcc').value.trim();
        const ifsc = mount.querySelector('#bIfsc').value.trim().toUpperCase();
        if (!name || acc.length < 6 || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
            return showPopup({ type: 'error', title: 'Invalid Details', message: 'Provide a valid name, account number, and standard IFSC code.' });
        }
        setLoading(true);
        await updateDoc(USER_REF, { bank: { name, account: acc, ifsc } });
        setLoading(false);
        close(); onClose?.();
        showPopup({ type: 'success', title: 'Endpoint Bound', message: 'Your bank endpoint has been committed to the cloud ledger.' });
    });
}

function openAbout() {
    const html = `
        <div class="note-info">
            <strong>Vortex Quantum Digital Capital Pvt. Ltd.</strong><br/>
            Institutional quantitative liquidity engine operating across global digital exchanges. We deploy high-frequency arbitrage, market-making and yield strategies underpinned by AI orchestration and low-latency infrastructure.
        </div>
        <p class="block-sub">Compliance · KYC/AML aligned, AES-256 encrypted ledger, segregated client vaults, multi-signature treasury controls. Customer assets are insulated from operational treasury at all times.</p>
        <p class="block-sub">Operational headquarters operate across Mumbai, Bangalore, Singapore and Dubai. For corporate enquiries email <strong style="color:var(--accent-3)">corporate@vortexquantum.io</strong>.</p>
    `;
    openSheet('🏢 About Vortex Quantum', html);
}

async function openLedger() {
    const { mount } = openSheet('📒 Bill Details', `<div class="empty-state">Loading ledger…</div>`);
    const q = query(collection(db, 'ledger'), where('uid', '==', CURRENT_USER.email));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const body = rows.length
        ? rows.map(r => `
            <div class="ledger-row">
                <div>
                    <strong>${r.note || r.type}</strong>
                    <small>${fmtDate(r.createdAt)} · ${r.type}</small>
                </div>
                <div class="ledger-amt ${r.sign === '-' ? 'minus' : 'plus'}">${r.sign || '+'}₹${fmtINR(r.amount)}</div>
            </div>`).join('')
        : `<div class="empty-state">No ledger entries yet.</div>`;
    mount.querySelector('.modal-body').innerHTML = body;
}

async function openRechargeLog() {
    const { mount } = openSheet('💳 Recharge Records', `<div class="empty-state">Loading records…</div>`);
    const q = query(collection(db, 'rechargeRecords'), where('uid', '==', CURRENT_USER.email));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const body = rows.length
        ? rows.map(r => `
            <div class="ledger-row">
                <div>
                    <strong>₹${fmtINR(r.amount)} · UTR ${r.utr}</strong>
                    <small>${fmtDate(r.createdAt)} · ${r.channel}</small>
                </div>
                <span class="status-pill ${r.status}">${r.status}</span>
            </div>`).join('')
        : `<div class="empty-state">No recharge records yet.</div>`;
    mount.querySelector('.modal-body').innerHTML = body;
}

async function openWithdrawLog() {
    const { mount } = openSheet('📤 Withdrawal Records', `<div class="empty-state">Loading records…</div>`);
    const q = query(collection(db, 'withdrawRecords'), where('uid', '==', CURRENT_USER.email));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const body = rows.length
        ? rows.map(r => `
            <div class="ledger-row">
                <div>
                    <strong>₹${fmtINR(r.amount)}</strong>
                    <small>${fmtDate(r.createdAt)} · ${r.bank?.account || ''}</small>
                </div>
                <span class="status-pill ${r.status}">${r.status}</span>
            </div>`).join('')
        : `<div class="empty-state">No withdrawal records yet.</div>`;
    mount.querySelector('.modal-body').innerHTML = body;
}

async function openTeam() {
    const { mount } = openSheet('👥 My Team Grid', `<div class="empty-state">Querying downstream…</div>`);
    const myPhone = USER_DATA.phone;

    // Level 1: users referred by me
    const l1Q = query(collection(db, 'users'), where('referrer', '==', myPhone));
    const l1Snap = await getDocs(l1Q);
    const l1 = [];
    l1Snap.forEach(d => l1.push(d.data()));

    // Level 2: users referred by my L1 downstream
    let l2Count = 0;
    if (l1.length) {
        const phones = l1.map(u => u.phone);
        // Firestore "in" capped at 10 — chunk
        for (let i = 0; i < phones.length; i += 10) {
            const chunk = phones.slice(i, i + 10);
            const l2Q = query(collection(db, 'users'), where('referrer', 'in', chunk));
            const l2Snap = await getDocs(l2Q);
            l2Count += l2Snap.size;
        }
    }

    const commission = (USER_DATA.promotion || 0);
    const list = l1.length
        ? l1.map(u => `<div class="ledger-row"><div><strong>+91 ${u.phone}</strong><small>Joined ${fmtDate(u.createdAt)}</small></div><span class="status-pill success">L1</span></div>`).join('')
        : `<div class="empty-state">No downstream members yet. Share your referral link from the Share panel.</div>`;

    mount.querySelector('.modal-body').innerHTML = `
        <div class="metric-row">
            <div class="metric-card"><span>Level 1</span><strong>${l1.length}</strong></div>
            <div class="metric-card"><span>Level 2</span><strong>${l2Count}</strong></div>
            <div class="metric-card"><span>Commission</span><strong>₹${fmtINR(commission)}</strong></div>
        </div>
        ${list}
    `;
}

/* =========================================================
   PAGE ROUTER
   ========================================================= */
const pathEnd = location.pathname.split('/').pop() || 'index.html';
if (pathEnd === 'dashboard.html') {
    bootDashboard();
} else {
    bootAuthPage();
}
