import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import {
  subscribeIceCreams,
  saveIceCream,
  deleteIceCream,
  recordPriceChange,
  subscribeIceCreamOrder,
  saveIceCreamOrder,
} from '../firebase/store';

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function IceCreamsScreen() {
  const [iceCreams, setIceCreams] = useState([]);
  const [iceCreamOrder, setIceCreamOrder] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    const u1 = subscribeIceCreams(
      (items) => setIceCreams(items),
      (e) => Alert.alert('Firebase Error', e?.message || 'Could not load ice creams.')
    );
    const u2 = subscribeIceCreamOrder((order) => setIceCreamOrder(order));
    return () => { u1(); u2(); };
  }, []);

  const sortedIceCreams = useMemo(() => {
    if (iceCreamOrder.length === 0) return iceCreams;
    const map = Object.fromEntries(iceCreams.map((ic) => [ic.id, ic]));
    const ordered = iceCreamOrder.map((id) => map[id]).filter(Boolean);
    const inOrder = new Set(iceCreamOrder);
    const unordered = iceCreams.filter((ic) => !inOrder.has(ic.id));
    return [...ordered, ...unordered];
  }, [iceCreams, iceCreamOrder]);

  const openAdd = () => {
    setEditId(null);
    setName('');
    setPrice('');
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setName(item.name);
    setPrice(String(item.price));
    setModalVisible(true);
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const parsedPrice = parseFloat(price);
    if (!trimmedName) {
      Alert.alert('Error', 'Ice cream name is required.');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Error', 'Enter a valid price greater than 0.');
      return;
    }
    const id = editId || genId();
    setModalVisible(false);
    if (!editId) {
      const newOrder = [...iceCreamOrder, id];
      saveIceCreamOrder(newOrder).catch(() => {});
    }
    saveIceCream({ id, name: trimmedName, price: parsedPrice })
      .catch((e) => Alert.alert('Save Failed', e?.message || 'Could not save. Check your internet connection.'));
    recordPriceChange(id, parsedPrice, todayStr()).catch(() => {});
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Ice Cream', 'Remove this ice cream from the list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteIceCream(id).catch(() => {});
          saveIceCreamOrder(iceCreamOrder.filter((oid) => oid !== id)).catch(() => {});
        },
      },
    ]);
  };

  const onDragEnd = ({ data }) => {
    const newOrder = data.map((ic) => ic.id);
    saveIceCreamOrder(newOrder).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <DraggableFlatList
        data={sortedIceCreams}
        keyExtractor={(item) => item.id}
        onDragEnd={onDragEnd}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No ice creams added yet. Tap below to add one.</Text>
        }
        renderItem={({ item, drag, isActive }) => (
          <ScaleDecorator>
            <TouchableOpacity
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => openEdit(item)}
              activeOpacity={0.8}
            >
              <TouchableOpacity
                onLongPress={drag}
                delayLongPress={150}
                style={styles.dragHandle}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              >
                <Text style={styles.dragIcon}>☰</Text>
              </TouchableOpacity>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardPrice}>₹{item.price.toFixed(2)} per unit</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                style={styles.deleteBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </ScaleDecorator>
        )}
      />
      <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
        <Text style={styles.addBtnText}>+ Add Ice Cream</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editId ? 'Edit Ice Cream' : 'New Ice Cream'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Name (e.g. Vanilla, Strawberry)"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Price per unit (₹)"
              placeholderTextColor="#999"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  list: { padding: 16, paddingBottom: 100 },
  empty: {
    textAlign: 'center',
    color: '#999',
    marginTop: 60,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardActive: {
    elevation: 8,
    shadowOpacity: 0.18,
    backgroundColor: '#F0F9FF',
  },
  dragHandle: {
    paddingRight: 12,
    paddingLeft: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragIcon: { fontSize: 18, color: '#C0C8D4' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  cardPrice: { fontSize: 13, color: '#666', marginTop: 3 },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  addBtn: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#2E86AB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#2E86AB',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { color: '#666', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2E86AB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
