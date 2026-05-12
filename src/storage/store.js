import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ICE_CREAMS: 'icecreams',
  VENDORS: 'vendors',
  TRANSACTIONS: 'transactions',
  PRICE_HISTORY: 'price_history',
};

export const getIceCreams = async () => {
  const data = await AsyncStorage.getItem(KEYS.ICE_CREAMS);
  return data ? JSON.parse(data) : [];
};

export const saveIceCreams = async (items) => {
  await AsyncStorage.setItem(KEYS.ICE_CREAMS, JSON.stringify(items));
};

export const getVendors = async () => {
  const data = await AsyncStorage.getItem(KEYS.VENDORS);
  return data ? JSON.parse(data) : [];
};

export const saveVendors = async (items) => {
  await AsyncStorage.setItem(KEYS.VENDORS, JSON.stringify(items));
};

export const getTransaction = async (vendorId, date) => {
  const all = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
  const parsed = all ? JSON.parse(all) : {};
  return parsed[`${vendorId}__${date}`] || null;
};

export const saveTransaction = async (vendorId, date, items) => {
  const all = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
  const parsed = all ? JSON.parse(all) : {};
  parsed[`${vendorId}__${date}`] = {
    vendorId,
    date,
    items,
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(parsed));
};

// Records a price change for an ice cream on a given date (YYYY-MM-DD)
export const recordPriceChange = async (iceCreamId, price, dateStr) => {
  const raw = await AsyncStorage.getItem(KEYS.PRICE_HISTORY);
  const history = raw ? JSON.parse(raw) : {};
  if (!history[iceCreamId]) history[iceCreamId] = [];
  // Remove any existing entry for the same date and add the new one
  history[iceCreamId] = history[iceCreamId].filter((e) => e.from !== dateStr);
  history[iceCreamId].push({ price, from: dateStr });
  history[iceCreamId].sort((a, b) => a.from.localeCompare(b.from));
  await AsyncStorage.setItem(KEYS.PRICE_HISTORY, JSON.stringify(history));
};

// Returns the price that was effective for an ice cream on a given date
export const getPriceOnDate = async (iceCreamId, dateStr, fallbackPrice) => {
  const raw = await AsyncStorage.getItem(KEYS.PRICE_HISTORY);
  const history = raw ? JSON.parse(raw) : {};
  const entries = history[iceCreamId];
  if (!entries || entries.length === 0) return fallbackPrice;
  const applicable = entries.filter((e) => e.from <= dateStr);
  if (applicable.length === 0) return entries[0].price;
  return applicable[applicable.length - 1].price;
};

export const getAllData = async () => {
  const [iceCreams, vendors, transactions, priceHistory] = await Promise.all([
    AsyncStorage.getItem(KEYS.ICE_CREAMS),
    AsyncStorage.getItem(KEYS.VENDORS),
    AsyncStorage.getItem(KEYS.TRANSACTIONS),
    AsyncStorage.getItem(KEYS.PRICE_HISTORY),
  ]);
  return {
    iceCreams: iceCreams ? JSON.parse(iceCreams) : [],
    vendors: vendors ? JSON.parse(vendors) : [],
    transactions: transactions ? JSON.parse(transactions) : {},
    priceHistory: priceHistory ? JSON.parse(priceHistory) : {},
    exportedAt: new Date().toISOString(),
    version: 2,
  };
};

export const restoreAllData = async (data) => {
  if (!data || (data.version !== 1 && data.version !== 2)) {
    throw new Error('Invalid backup file.');
  }
  await Promise.all([
    AsyncStorage.setItem(KEYS.ICE_CREAMS, JSON.stringify(data.iceCreams || [])),
    AsyncStorage.setItem(KEYS.VENDORS, JSON.stringify(data.vendors || [])),
    AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(data.transactions || {})),
    AsyncStorage.setItem(KEYS.PRICE_HISTORY, JSON.stringify(data.priceHistory || {})),
  ]);
};
