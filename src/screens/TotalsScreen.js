import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { subscribeAllTransactions, subscribeVendors } from '../firebase/store';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const monthKey = (year, month) =>
  `${year}-${String(month + 1).padStart(2, '0')}`;

const calcTransactionAmounts = (items) => {
  const subtotal = (items || []).reduce((sum, item) => {
    const diff = Math.max(0, (item.quantityTaken || 0) - (item.quantityReturned || 0));
    return sum + diff * (item.priceAtTime || 0);
  }, 0);
  const deduction = subtotal * 0.2;
  return { subtotal, amountToPay: subtotal - deduction };
};

export default function TotalsScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [vendors, setVendors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u1 = subscribeVendors((v) => setVendors(v));
    const u2 = subscribeAllTransactions((t) => {
      setTransactions(t);
      setLoading(false);
    });
    return () => { u1(); u2(); };
  }, []);

  const goBack = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const goForward = () => {
    const now = new Date();
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth())) {
      if (month === 11) { setMonth(0); setYear((y) => y + 1); }
      else setMonth((m) => m + 1);
    }
  };

  const prefix = monthKey(year, month);
  const monthTxns = transactions.filter((t) => t.date && t.date.startsWith(prefix));

  // Build per-vendor totals
  const vendorMap = {};
  vendors.forEach((v) => { vendorMap[v.id] = { vendor: v, subtotal: 0, amountToPay: 0 }; });

  monthTxns.forEach((t) => {
    const { subtotal, amountToPay } = calcTransactionAmounts(t.items);
    if (!vendorMap[t.vendorId]) {
      vendorMap[t.vendorId] = { vendor: { name: 'Unknown Vendor' }, subtotal: 0, amountToPay: 0 };
    }
    vendorMap[t.vendorId].subtotal += subtotal;
    vendorMap[t.vendorId].amountToPay += amountToPay;
  });

  const vendorRows = Object.values(vendorMap).filter((v) => v.subtotal > 0);
  const grandSubtotal = vendorRows.reduce((s, v) => s + v.subtotal, 0);
  const grandAmountToPay = vendorRows.reduce((s, v) => s + v.amountToPay, 0);
  const grandDeduction = grandSubtotal - grandAmountToPay;

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <View style={styles.container}>
      {/* Month selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={goBack} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.monthLabel}>
          <Text style={styles.monthText}>{MONTH_NAMES[month]} {year}</Text>
          {isCurrentMonth && <Text style={styles.currentBadge}>Current Month</Text>}
        </View>
        <TouchableOpacity
          onPress={goForward}
          style={[styles.arrow, isCurrentMonth && styles.arrowDisabled]}
          disabled={isCurrentMonth}
        >
          <Text style={[styles.arrowText, isCurrentMonth && styles.arrowTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2E86AB" />
        </View>
      ) : vendorRows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>No transactions found for {MONTH_NAMES[month]} {year}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Vendor cards */}
          {vendorRows.map(({ vendor, subtotal, amountToPay }) => (
            <View key={vendor.id || vendor.name} style={styles.vendorCard}>
              <View style={styles.vendorHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(vendor.name || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.vendorName}>{vendor.name}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Subtotal</Text>
                <Text style={styles.rowValue}>₹{subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>20% Deduction</Text>
                <Text style={[styles.rowValue, styles.deduction]}>
                  − ₹{(subtotal - amountToPay).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.row, styles.amountRow]}>
                <Text style={styles.amountLabel}>Amount to Pay</Text>
                <Text style={styles.amountValue}>₹{amountToPay.toFixed(2)}</Text>
              </View>
            </View>
          ))}

          {/* Grand total */}
          <View style={styles.grandCard}>
            <Text style={styles.grandTitle}>Monthly Grand Total</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Total Subtotal</Text>
              <Text style={styles.rowValue}>₹{grandSubtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Total 20% Deduction</Text>
              <Text style={[styles.rowValue, styles.deduction]}>
                − ₹{grandDeduction.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.row, styles.amountRow]}>
              <Text style={styles.grandAmountLabel}>Total to Collect</Text>
              <Text style={styles.grandAmountValue}>₹{grandAmountToPay.toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },

  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  arrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
  },
  arrowDisabled: { backgroundColor: '#F3F4F6' },
  arrowText: { fontSize: 26, color: '#2E86AB', fontWeight: '700', lineHeight: 30 },
  arrowTextDisabled: { color: '#D1D5DB' },
  monthLabel: { flex: 1, alignItems: 'center' },
  monthText: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  currentBadge: {
    fontSize: 11,
    color: '#2E86AB',
    fontWeight: '600',
    marginTop: 2,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 15, color: '#999', textAlign: 'center', lineHeight: 22 },

  scroll: { padding: 16, paddingBottom: 40 },

  vendorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2E86AB22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#2E86AB' },
  vendorName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowLabel: { fontSize: 13, color: '#666' },
  rowValue: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  deduction: { color: '#EF4444' },
  amountRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginBottom: 0,
  },
  amountLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  amountValue: { fontSize: 15, fontWeight: '800', color: '#16A34A' },

  grandCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  grandTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  grandAmountLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  grandAmountValue: { fontSize: 18, fontWeight: '800', color: '#4ADE80' },
});
