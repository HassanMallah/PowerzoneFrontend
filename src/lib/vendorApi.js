import { api } from './api';

let useLocalStorageFallback = false;

async function request(path, options = {}) {
  if (useLocalStorageFallback) {
    return runFallback(path, options);
  }
  try {
    return await api(path, options);
  } catch (err) {
    if (err.message.includes('404') || err.message.includes('Fetch') || err.message.includes('Failed to fetch')) {
      console.warn(`Backend endpoint ${path} not found or unreachable. Falling back to local storage for vendors.`);
      useLocalStorageFallback = true;
      return runFallback(path, options);
    }
    throw err;
  }
}

function runFallback(path, options = {}) {
  const getDb = () => {
    const db = localStorage.getItem('powerzone_vendors_db');
    if (db) return JSON.parse(db);
    return { vendors: [], purchases: [], payments: [] };
  };

  const saveDb = (db) => {
    localStorage.setItem('powerzone_vendors_db', JSON.stringify(db));
  };

  const db = getDb();
  const method = options.method || 'GET';

  if (path === '/vendors' && method === 'GET') {
    return { vendors: db.vendors };
  }

  if (path === '/vendors' && method === 'POST') {
    const body = JSON.parse(options.body);
    const newVendor = {
      id: 'v_' + Date.now(),
      name: body.name,
      phone: body.phone || '',
      address: body.address || '',
      created_at: new Date().toISOString()
    };
    db.vendors.push(newVendor);
    saveDb(db);
    return { vendor: newVendor };
  }

  if (path.startsWith('/vendors/') && method === 'DELETE' && !path.includes('purchases') && !path.includes('payments')) {
    const id = path.split('/').pop();
    db.vendors = db.vendors.filter(v => v.id !== id);
    db.purchases = db.purchases.filter(p => p.vendorId !== id);
    db.payments = db.payments.filter(p => p.vendorId !== id);
    saveDb(db);
    return { success: true };
  }

  if (path === '/vendors/purchases' && method === 'GET') {
    return { purchases: db.purchases };
  }

  if (path === '/vendors/purchases' && method === 'POST') {
    const body = JSON.parse(options.body);
    const newPurchase = {
      id: 'p_' + Date.now(),
      vendorId: body.vendorId,
      siteId: body.siteId || null,
      category: body.category,
      description: body.description,
      totalAmount: Number(body.totalAmount),
      paidAmount: Number(body.paidAmount),
      remainingAmount: Number(body.totalAmount) - Number(body.paidAmount),
      date: body.date || new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    };
    db.purchases.push(newPurchase);
    saveDb(db);
    return { purchase: newPurchase };
  }

  if (path.startsWith('/vendors/purchases/') && method === 'DELETE') {
    const id = path.split('/').pop();
    db.purchases = db.purchases.filter(p => p.id !== id);
    saveDb(db);
    return { success: true };
  }

  if (path === '/vendors/payments' && method === 'GET') {
    return { payments: db.payments };
  }

  if (path === '/vendors/payments' && method === 'POST') {
    const body = JSON.parse(options.body);
    const newPayment = {
      id: 'pay_' + Date.now(),
      vendorId: body.vendorId,
      amount: Number(body.amount),
      date: body.date || new Date().toISOString().slice(0, 10),
      note: body.note || '',
      created_at: new Date().toISOString()
    };
    db.payments.push(newPayment);
    saveDb(db);
    return { payment: newPayment };
  }

  if (path.startsWith('/vendors/payments/') && method === 'DELETE') {
    const id = path.split('/').pop();
    db.payments = db.payments.filter(p => p.id !== id);
    saveDb(db);
    return { success: true };
  }

  throw new Error(`Mock endpoint not found: ${method} ${path}`);
}

export async function getVendors() {
  return request('/vendors');
}

export async function createVendor(name, phone = '', address = '') {
  return request('/vendors', {
    method: 'POST',
    body: JSON.stringify({ name, phone, address })
  });
}

export async function deleteVendor(id) {
  return request(`/vendors/${id}`, {
    method: 'DELETE'
  });
}

export async function getVendorPurchases() {
  return request('/vendors/purchases');
}

export async function createVendorPurchase(vendorId, siteId, category, description, totalAmount, paidAmount, date) {
  return request('/vendors/purchases', {
    method: 'POST',
    body: JSON.stringify({ vendorId, siteId, category, description, totalAmount, paidAmount, date })
  });
}

export async function deleteVendorPurchase(id) {
  return request(`/vendors/purchases/${id}`, {
    method: 'DELETE'
  });
}

export async function getVendorPayments() {
  return request('/vendors/payments');
}

export async function createVendorPayment(vendorId, amount, date, note) {
  return request('/vendors/payments', {
    method: 'POST',
    body: JSON.stringify({ vendorId, amount, date, note })
  });
}

export async function deleteVendorPayment(id) {
  return request(`/vendors/payments/${id}`, {
    method: 'DELETE'
  });
}
