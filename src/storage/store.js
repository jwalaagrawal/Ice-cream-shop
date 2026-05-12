import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ICE_CREAMS: 'icecreams',
  VENDORS: 'vendors',
  TRANSACTIONS: 'transactions',
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

export const getAllData = async () => {
  const [iceCreams, vendors, transactions] = await Promise.all([
    AsyncStorage.getItem(KEYS.ICE_CREAMS),
    AsyncStorage.getItem(KEYS.VENDORS),
    AsyncStorage.getItem(KEYS.TRANSACTIONS),
  ]);
  return {
    iceCreams: iceCreams ? JSON.parse(iceCreams) : [],
    vendors: vendors ? JSON.parse(vendors) : [],
    transactions: transactions ? JSON.parse(transactions) : {},
    exportedAt: new Date().toISOString(),
    version: 1,
  };
};

export const restoreAllData = async (data) => {
  if (!data || data.version !== 1) throw new Error('Invalid backup file.');
  await Promise.all([
    AsyncStorage.setItem(KEYS.ICE_CREAMS, JSON.stringify(data.iceCreams || [])),
    AsyncStorage.setItem(KEYS.VENDORS, JSON.stringify(data.vendors || [])),
    AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(data.transactions || {})),
  ]);
};
