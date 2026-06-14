// Firebase Configuration & Helpers
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

// Initialize Firebase (compat SDK)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ====================== Data Layer ======================
const DB = {
  userRef(phone) { return db.ref('users/' + phone); },

  async getUser(phone) {
    const snap = await this.userRef(phone).once('value');
    return snap.val();
  },

  async createUser(phone, password) {
    const existing = await this.getUser(phone);
    if (existing) throw new Error('Phone already registered');
    const uid = 'SC' + Math.floor(100000 + Math.random() * 900000);
    const newUser = {
      uid,
      phone,
      password, // demo only – plain text
      balance: 50, // signup bonus
      promotion_income: 0,
      invest_income: 0,
      recharge_total: 0,
      withdraw_total: 0,
      created_at: Date.now(),
      bank: null,
      last_checkin: 0,
      last_giftcode: 0,
      orders: {},
      recharge_records: {},
      withdraw_records: {},
      team: []
    };
    await this.userRef(phone).set(newUser);
    return newUser;
  },

  async updateUser(phone, data) {
    await this.userRef(phone).update(data);
  },

  async pushOrder(phone, order) {
    await this.userRef(phone).child('orders').push(order);
  },

  async pushRecharge(phone, rec) {
    await this.userRef(phone).child('recharge_records').push(rec);
  },

  async pushWithdraw(phone, wd) {
    await this.userRef(phone).child('withdraw_records').push(wd);
  }
};

// ====================== Session ======================
const Session = {
  set(phone) { localStorage.setItem('scarlet_session', phone); },
  get() { return localStorage.getItem('scarlet_session'); },
  clear() { localStorage.removeItem('scarlet_session'); }
};

// ====================== Toast / Popup ======================
function showToast(msg, type='info') {
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.innerHTML = `<span class="toast-icon">${type==='success'?'✓':type==='error'?'✕':'i'}</span><span>${msg}</span>`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(), 400); }, 3000);
}

function showPopup(title, body, actions=[{label:'OK', primary:true}]) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.innerHTML = `
      <div class="popup">
        <div class="popup-header">${title}</div>
        <div class="popup-body">${body}</div>
        <div class="popup-actions">
          ${actions.map((a,i)=>`<button data-i="${i}" class="${a.primary?'btn-primary':'btn-secondary'}">${a.label}</button>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(()=>overlay.classList.add('show'), 10);
    overlay.querySelectorAll('button').forEach(b => b.onclick = () => {
      overlay.classList.remove('show');
      setTimeout(()=>overlay.remove(), 300);
      resolve(parseInt(b.dataset.i));
    });
  });
}

// Helpers
const randInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
const today = () => new Date().toISOString().slice(0,10);
const isSameDay = (ts) => ts && new Date(ts).toISOString().slice(0,10) === today();
