import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  writeBatch,
  enableNetwork as firestoreEnableNetwork,
} from 'firebase/firestore';
import { db } from './config';

export const enableNetwork = () => firestoreEnableNetwork(db);

// ─── ICE CREAMS ───────────────────────────────────────────────────────────────

export const subscribeIceCreams = (callback, onError) =>
  onSnapshot(collection(db, 'icecreams'),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError || ((e) => console.error('subscribeIceCreams:', e))
  );

export const saveIceCream = (iceCream) =>
  setDoc(doc(db, 'icecreams', iceCream.id), iceCream);

export const deleteIceCream = (id) => deleteDoc(doc(db, 'icecreams', id));

// ─── VENDORS ──────────────────────────────────────────────────────────────────

export const subscribeVendors = (callback) =>
  onSnapshot(collection(db, 'vendors'), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

export const saveVendor = (vendor) =>
  setDoc(doc(db, 'vendors', vendor.id), vendor);

export const deleteVendor = (id) => deleteDoc(doc(db, 'vendors', id));

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

export const subscribeTransaction = (vendorId, date, callback) =>
  onSnapshot(doc(db, 'transactions', `${vendorId}__${date}`), (snap) =>
    callback(snap.exists() ? snap.data() : null)
  );

export const subscribeAllTransactions = (callback) =>
  onSnapshot(collection(db, 'transactions'), (snap) =>
    callback(snap.docs.map((d) => d.data()))
  );

export const saveTransaction = (vendorId, date, items) =>
  setDoc(doc(db, 'transactions', `${vendorId}__${date}`), {
    vendorId,
    date,
    items,
    savedAt: new Date().toISOString(),
  });

// ─── PRICE HISTORY ────────────────────────────────────────────────────────────

export const recordPriceChange = async (iceCreamId, price, dateStr) => {
  const ref = doc(db, 'priceHistory', iceCreamId);
  const snap = await getDoc(ref);
  let entries = snap.exists() ? snap.data().entries || [] : [];
  entries = entries.filter((e) => e.from !== dateStr);
  entries.push({ price, from: dateStr });
  entries.sort((a, b) => a.from.localeCompare(b.from));
  await setDoc(ref, { entries });
};

export const getPriceOnDate = async (iceCreamId, dateStr, fallbackPrice) => {
  const snap = await getDoc(doc(db, 'priceHistory', iceCreamId));
  if (!snap.exists()) return fallbackPrice;
  const entries = snap.data().entries || [];
  if (entries.length === 0) return fallbackPrice;
  const applicable = entries.filter((e) => e.from <= dateStr);
  return applicable.length > 0
    ? applicable[applicable.length - 1].price
    : entries[0].price;
};

// Seeds a baseline price entry (2000-01-01) for any ice cream with no history.
export const initializePriceHistory = async (iceCreams) => {
  for (const ic of iceCreams) {
    const ref = doc(db, 'priceHistory', ic.id);
    const snap = await getDoc(ref);
    if (!snap.exists() || (snap.data().entries || []).length === 0) {
      await setDoc(ref, { entries: [{ price: ic.price, from: '2000-01-01' }] });
    } else {
      const entries = snap.data().entries;
      if (!entries.some((e) => e.from === '2000-01-01')) {
        await setDoc(ref, {
          entries: [{ price: entries[0].price, from: '2000-01-01' }, ...entries],
        });
      }
    }
  }
};

// ─── BACKUP & RESTORE ─────────────────────────────────────────────────────────

export const getAllData = async () => {
  const [icsSnap, vendsSnap, transSnap] = await Promise.all([
    getDocs(collection(db, 'icecreams')),
    getDocs(collection(db, 'vendors')),
    getDocs(collection(db, 'transactions')),
  ]);
  const transactions = {};
  transSnap.docs.forEach((d) => { transactions[d.id] = d.data(); });
  return {
    iceCreams: icsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    vendors: vendsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    transactions,
    exportedAt: new Date().toISOString(),
    version: 2,
  };
};

export const restoreAllData = async (data) => {
  if (!data || (data.version !== 1 && data.version !== 2)) {
    throw new Error('Invalid backup file.');
  }
  const batch = writeBatch(db);
  (data.iceCreams || []).forEach((ic) => batch.set(doc(db, 'icecreams', ic.id), ic));
  (data.vendors || []).forEach((v) => batch.set(doc(db, 'vendors', v.id), v));
  Object.entries(data.transactions || {}).forEach(([key, val]) =>
    batch.set(doc(db, 'transactions', key), val)
  );
  await batch.commit();
};

// ─── CLEANUP ──────────────────────────────────────────────────────────────────

export const cleanupOldTransactions = async () => {
  const snap = await getDocs(collection(db, 'transactions'));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const batch = writeBatch(db);
  let count = 0;
  snap.docs.forEach((d) => {
    if ((d.data().date || '') < cutoffStr) {
      batch.delete(d.ref);
      count++;
    }
  });
  if (count > 0) await batch.commit();
  return count;
};

// ─── MIGRATION ────────────────────────────────────────────────────────────────

// Uploads existing local data to Firestore (runs once on first launch).
export const migrateFromAsyncStorage = async (localData) => {
  if (!localData.iceCreams?.length && !localData.vendors?.length) return;
  const batch = writeBatch(db);
  (localData.iceCreams || []).forEach((ic) => batch.set(doc(db, 'icecreams', ic.id), ic));
  (localData.vendors || []).forEach((v) => batch.set(doc(db, 'vendors', v.id), v));
  Object.entries(localData.transactions || {}).forEach(([key, val]) =>
    batch.set(doc(db, 'transactions', key), val)
  );
  await batch.commit();
};
