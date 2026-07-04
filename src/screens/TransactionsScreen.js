import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  subscribeIceCreams,
  subscribeVendors,
  subscribeTransaction,
  saveTransaction,
  getPriceOnDate,
  subscribeIceCreamOrder,
} from '../firebase/store';
import { calcDifference, calcRowTotal, calcSummary } from '../utils/calculations';

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const displayDate = (date) =>
  date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function TransactionsScreen() {
  const [iceCreams, setIceCreams] = useState([]);
  const [iceCreamOrder, setIceCreamOrder] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [rows, setRows] = useState({});
  const [effectivePrices, setEffectivePrices] = useState({});
  const [change, setChange] = useState('');
  const [paid, setPaid] = useState('');
  // Track whether the user has made unsaved edits (prevents remote updates overwriting local typing)
  const isDirty = useRef(false);

  // Subscribe to ice creams + vendors
  useEffect(() => {
    const u1 = subscribeIceCreams((items) => setIceCreams(items));
    const u2 = subscribeVendors((items) =>
      setVendors(items.sort((a, b) => a.name.localeCompare(b.name)))
    );
    const u3 = subscribeIceCreamOrder((order) => setIceCreamOrder(order));
    return () => { u1(); u2(); u3(); };
  }, []);

  // Load effective prices and subscribe to transaction when vendor/date changes
  useEffect(() => {
    if (!selectedVendor || sortedIceCreams.length === 0) return;
    isDirty.current = false;
    setChange('');
    setPaid('');
    const dateKey = formatDate(selectedDate);

    // Fetch historical price for each ice cream on the selected date
    Promise.all(
      sortedIceCreams.map(async (ic) => {
        const p = await getPriceOnDate(ic.id, dateKey, ic.price);
        return [ic.id, p];
      })
    ).then((entries) => setEffectivePrices(Object.fromEntries(entries)));

    // Real-time listener on the transaction document
    const unsubscribe = subscribeTransaction(selectedVendor.id, dateKey, (record) => {
      if (isDirty.current) return; // Don't overwrite local edits
      if (record) {
        const loaded = {};
        record.items.forEach((item) => {
          loaded[item.iceCreamId] = {
            quantityTaken: String(item.quantityTaken),
            quantityReturned: String(item.quantityReturned),
          };
        });
        setRows(loaded);
        setChange(record.change ? String(record.change) : '');
        setPaid(record.paid ? String(record.paid) : '');
        // Override effectivePrices with saved priceAtTime values
        setEffectivePrices((prev) => {
          const updated = { ...prev };
          record.items.forEach((item) => {
            if (item.priceAtTime != null) updated[item.iceCreamId] = item.priceAtTime;
          });
          return updated;
        });
      } else {
        setRows({});
        setChange('');
        setPaid('');
      }
    });

    return unsubscribe;
  }, [selectedVendor, selectedDate, sortedIceCreams]);

  const updateRow = (iceCreamId, field, value) => {
    isDirty.current = true;
    setRows((prev) => ({
      ...prev,
      [iceCreamId]: { ...prev[iceCreamId], [field]: value },
    }));
  };

  const getRow = (iceCreamId) =>
    rows[iceCreamId] || { quantityTaken: '', quantityReturned: '' };

  const handleSave = async () => {
    if (!selectedVendor) {
      Alert.alert('Select Vendor', 'Please select a vendor first.');
      return;
    }
    const invalid = sortedIceCreams.filter((ic) => {
      const row = getRow(ic.id);
      return (parseFloat(row.quantityReturned) || 0) > (parseFloat(row.quantityTaken) || 0);
    });
    if (invalid.length > 0) {
      Alert.alert(
        'Invalid Quantity',
        `Returned cannot be greater than Taken for: ${invalid.map((ic) => ic.name).join(', ')}`
      );
      return;
    }
    const items = sortedIceCreams
      .map((ic) => {
        const row = getRow(ic.id);
        return {
          iceCreamId: ic.id,
          quantityTaken: parseFloat(row.quantityTaken) || 0,
          quantityReturned: parseFloat(row.quantityReturned) || 0,
          priceAtTime: effectivePrices[ic.id] ?? ic.price,
        };
      })
      .filter((item) => item.quantityTaken > 0 || item.quantityReturned > 0);

    await saveTransaction(selectedVendor.id, formatDate(selectedDate), items, parseFloat(change) || 0, parseFloat(paid) || 0);
    isDirty.current = false;
    Alert.alert('Saved', 'Transaction saved successfully.');
  };

  const sortedIceCreams = React.useMemo(() => {
    if (iceCreamOrder.length === 0) return iceCreams;
    const map = Object.fromEntries(iceCreams.map((ic) => [ic.id, ic]));
    const ordered = iceCreamOrder.map((id) => map[id]).filter(Boolean);
    const inOrder = new Set(iceCreamOrder);
    return [...ordered, ...iceCreams.filter((ic) => !inOrder.has(ic.id))];
  }, [iceCreams, iceCreamOrder]);

  const iceCreamsWithEffectivePrices = sortedIceCreams.map((ic) => ({
    ...ic,
    price: effectivePrices[ic.id] ?? ic.price,
  }));
  const rowsForCalc = sortedIceCreams.map((ic) => ({
    iceCreamId: ic.id,
    ...getRow(ic.id),
  }));
  const { subtotal, deduction, finalAmount } = calcSummary(rowsForCalc, iceCreamsWithEffectivePrices);
  const changeVal = parseFloat(change) || 0;
  const paidVal = parseFloat(paid) || 0;
  const balanceDue = finalAmount + changeVal - paidVal;

  return (
    <View style={styles.container}>
      <View style={styles.selectors}>
        <TouchableOpacity
          style={[styles.selector, styles.selectorLeft]}
          onPress={() => setShowVendorPicker(true)}
        >
          <Text style={styles.selectorLabel}>Vendor</Text>
          <Text style={styles.selectorValue} numberOfLines={1}>
            {selectedVendor ? selectedVendor.name : 'Select vendor'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selector, styles.selectorRight]}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.selectorLabel}>Date</Text>
          <Text style={styles.selectorValue}>{displayDate(selectedDate)}</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={new Date()}
          onChange={(event, date) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (date) setSelectedDate(date);
            if (Platform.OS === 'android') setShowDatePicker(false);
          }}
        />
      )}

      {!selectedVendor ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>📋</Text>
          <Text style={styles.placeholderText}>Select a vendor to enter transaction details</Text>
        </View>
      ) : sortedIceCreams.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>🍦</Text>
          <Text style={styles.placeholderText}>No ice creams found. Add some in the Ice Creams tab.</Text>
        </View>
      ) : (
        <ScrollView style={styles.tableWrapper} contentContainerStyle={{ paddingBottom: 200 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[styles.tableRow, styles.headerRow]}>
                <Text style={[styles.cell, styles.headerCell, styles.colName]}>Ice Cream</Text>
                <Text style={[styles.cell, styles.headerCell, styles.colPrice]}>Price</Text>
                <Text style={[styles.cell, styles.headerCell, styles.colQty]}>Taken</Text>
                <Text style={[styles.cell, styles.headerCell, styles.colQty]}>Returned</Text>
                <Text style={[styles.cell, styles.headerCell, styles.colQty]}>Diff</Text>
                <Text style={[styles.cell, styles.headerCell, styles.colTotal]}>Total (₹)</Text>
              </View>
              {sortedIceCreams.map((ic, index) => {
                const row = getRow(ic.id);
                const price = effectivePrices[ic.id] ?? ic.price;
                const taken = parseFloat(row.quantityTaken) || 0;
                const returned = parseFloat(row.quantityReturned) || 0;
                const isReturnedInvalid = returned > taken;
                const diff = calcDifference(row.quantityTaken, row.quantityReturned);
                const total = calcRowTotal(diff, price);
                return (
                  <View key={ic.id} style={[styles.tableRow, index % 2 === 0 && styles.rowEven]}>
                    <Text style={[styles.cell, styles.colName]} numberOfLines={2}>{ic.name}</Text>
                    <Text style={[styles.cell, styles.colPrice]}>₹{price.toFixed(0)}</Text>
                    <TextInput
                      style={[styles.cell, styles.colQty, styles.inputCell]}
                      value={row.quantityTaken}
                      onChangeText={(v) => updateRow(ic.id, 'quantityTaken', v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#ccc"
                    />
                    <TextInput
                      style={[styles.cell, styles.colQty, styles.inputCell,
                        isReturnedInvalid && styles.inputError]}
                      value={row.quantityReturned}
                      onChangeText={(v) => updateRow(ic.id, 'quantityReturned', v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#ccc"
                    />
                    <Text style={[styles.cell, styles.colQty, styles.calcCell]}>{diff}</Text>
                    <Text style={[styles.cell, styles.colTotal, styles.calcCell]}>
                      {total.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>20% Commission Deduction</Text>
              <Text style={[styles.summaryValue, styles.deductionText]}>− ₹{deduction.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.finalLabel}>Amount to Pay</Text>
              <Text style={styles.finalValue}>₹{finalAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Change</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputPrefix}>+ ₹</Text>
                <TextInput
                  style={styles.summaryInput}
                  value={change}
                  onChangeText={(v) => { isDirty.current = true; setChange(v); }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#ccc"
                />
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid</Text>
              <View style={styles.inputRow}>
                <Text style={[styles.inputPrefix, styles.deductionText]}>− ₹</Text>
                <TextInput
                  style={styles.summaryInput}
                  value={paid}
                  onChangeText={(v) => { isDirty.current = true; setPaid(v); }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#ccc"
                />
              </View>
            </View>
            <View style={[styles.summaryRow, styles.finalRow]}>
              <Text style={styles.finalLabel}>Balance Due</Text>
              <Text style={[styles.finalValue, balanceDue < 0 && styles.negativeBalance]}>
                ₹{balanceDue.toFixed(2)}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Transaction</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={showVendorPicker} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Vendor</Text>
            {vendors.length === 0 ? (
              <Text style={styles.empty}>No vendors added yet.</Text>
            ) : (
              <FlatList
                data={vendors}
                keyExtractor={(v) => v.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.vendorOption, selectedVendor?.id === item.id && styles.vendorSelected]}
                    onPress={() => { setSelectedVendor(item); setShowVendorPicker(false); }}
                  >
                    <Text style={[styles.vendorOptionText, selectedVendor?.id === item.id && styles.vendorSelectedText]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowVendorPicker(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const COL_NAME = 130, COL_PRICE = 60, COL_QTY = 72, COL_TOTAL = 85;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  selectors: { flexDirection: 'row', padding: 12, gap: 10 },
  selector: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  selectorLeft: {}, selectorRight: {},
  selectorLabel: { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 2 },
  selectorValue: { fontSize: 14, color: '#1A1A2E', fontWeight: '600' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  placeholderIcon: { fontSize: 48, marginBottom: 16 },
  placeholderText: { fontSize: 15, color: '#999', textAlign: 'center', lineHeight: 22 },
  tableWrapper: { flex: 1 },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerRow: { backgroundColor: '#2E86AB' },
  rowEven: { backgroundColor: '#F0F7FB' },
  cell: { paddingVertical: 10, paddingHorizontal: 6, fontSize: 13, color: '#1A1A2E' },
  headerCell: { color: '#fff', fontWeight: '700', fontSize: 12 },
  calcCell: { color: '#2E86AB', fontWeight: '600' },
  inputCell: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6,
    backgroundColor: '#fff', paddingVertical: 6, textAlign: 'center', marginVertical: 4,
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  colName: { width: COL_NAME }, colPrice: { width: COL_PRICE, textAlign: 'center' },
  colQty: { width: COL_QTY, textAlign: 'center' }, colTotal: { width: COL_TOTAL, textAlign: 'right' },
  summary: {
    margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryLabel: { fontSize: 14, color: '#555' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  deductionText: { color: '#EF4444' },
  finalRow: { borderBottomWidth: 0, marginTop: 8, paddingTop: 12, borderTopWidth: 2, borderTopColor: '#E5E7EB' },
  finalLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  finalValue: { fontSize: 18, fontWeight: '800', color: '#16A34A' },
  negativeBalance: { color: '#EF4444' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputPrefix: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginRight: 2 },
  summaryInput: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, fontSize: 14, fontWeight: '600',
    color: '#1A1A2E', backgroundColor: '#F9FAFB', minWidth: 80, textAlign: 'right',
  },
  saveBtn: {
    marginHorizontal: 16, marginBottom: 16, backgroundColor: '#16A34A', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', elevation: 4,
    shadowColor: '#16A34A', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  empty: { color: '#999', textAlign: 'center', fontSize: 14, padding: 20 },
  vendorOption: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, marginBottom: 6, backgroundColor: '#F9FAFB' },
  vendorSelected: { backgroundColor: '#2E86AB' },
  vendorOptionText: { fontSize: 16, color: '#1A1A2E', fontWeight: '500' },
  vendorSelectedText: { color: '#fff', fontWeight: '700' },
  closeBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  closeBtnText: { color: '#666', fontWeight: '600', fontSize: 15 },
});
