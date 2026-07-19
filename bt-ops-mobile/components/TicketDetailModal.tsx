import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, Modal,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import { confirmAction } from '@/utils/confirm';

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  category: string;
  assignees: string[];
  dueDate?: string;
  estimatedHours?: number;
  comments?: { text: string; user: string; timestamp: string }[];
  attachments?: { id: string; name: string; uploadedBy: string }[];
}

interface BasicUser { uid: string; displayName: string; role: string; }

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done', 'Blocked'];
const CATEGORIES = ['Operations', 'Sales', 'Content', 'Development', 'Trek Planning'];

export function TicketDetailModal({ ticket, onClose, onSaved }: {
  ticket: Ticket | null; onClose: () => void; onSaved: () => void;
}) {
  const { profile } = useAuth();
  const isNew = !ticket;
  const [title, setTitle] = useState(ticket?.title ?? '');
  const [description, setDescription] = useState(ticket?.description ?? '');
  const [priority, setPriority] = useState(ticket?.priority ?? 'Medium');
  const [status, setStatus] = useState(ticket?.status ?? 'Backlog');
  const [category, setCategory] = useState(ticket?.category ?? 'Operations');
  const [dueDate, setDueDate] = useState(ticket?.dueDate ?? '');
  const [estimatedHours, setEstimatedHours] = useState(ticket?.estimatedHours ? String(ticket.estimatedHours) : '');
  const [assignees, setAssignees] = useState<string[]>(ticket?.assignees ?? []);
  const [users, setUsers] = useState<BasicUser[]>([]);
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState(ticket?.comments ?? []);
  const [newComment, setNewComment] = useState('');
  const [attachments, setAttachments] = useState(ticket?.attachments ?? []);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/users/basic').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const toggleAssignee = (uid: string) => {
    setAssignees(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  };

  const save = async () => {
    if (!title.trim()) { Alert.alert('Title required', 'Enter a task title.'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description,
        priority,
        status,
        category,
        assignees,
        dueDate: dueDate || undefined,
        estimatedHours: estimatedHours ? parseInt(estimatedHours, 10) : undefined,
      };
      if (isNew) {
        await api.post('/tickets', payload);
      } else {
        await api.patch(`/tickets/${ticket!.id}`, payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save task');
    } finally { setSaving(false); }
  };

  const remove = () => {
    if (!ticket) return;
    confirmAction('Delete task', `Delete "${ticket.title}"?`, 'Delete', async () => {
      try { await api.delete(`/tickets/${ticket.id}`); onSaved(); onClose(); } catch { Alert.alert('Error', 'Could not delete'); }
    });
  };

  const addComment = async () => {
    if (!ticket || !newComment.trim()) return;
    try {
      const r = await api.post(`/tickets/${ticket.id}/comments`, { text: newComment.trim() });
      setComments(prev => [...prev, r.data.comment]);
      setNewComment('');
    } catch { Alert.alert('Error', 'Could not add comment'); }
  };

  const uploadAttachment = async () => {
    if (!ticket) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      const form = new FormData();
      // @ts-ignore
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      setUploading(true);
      const r = await api.post(`/tickets/${ticket.id}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAttachments(prev => [...prev, r.data]);
    } catch {
      Alert.alert('Error', 'Could not upload attachment');
    } finally { setUploading(false); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={s.title}>{isNew ? 'New Task' : 'Task'}</Text>
          {!isNew && (
            <TouchableOpacity onPress={remove}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={s.content}>
          <View style={s.field}>
            <Text style={s.label}>Title</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Task title" placeholderTextColor={Colors.gray400} />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Description</Text>
            <TextInput style={[s.input, s.textarea]} multiline value={description} onChangeText={setDescription} placeholder="Details…" placeholderTextColor={Colors.gray400} />
          </View>

          <View style={s.row3}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Priority</Text>
              <View style={s.pickerWrap}>
                <Picker selectedValue={priority} onValueChange={setPriority} style={s.picker}>
                  {PRIORITIES.map(p => <Picker.Item key={p} label={p} value={p} />)}
                </Picker>
              </View>
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Status</Text>
              <View style={s.pickerWrap}>
                <Picker selectedValue={status} onValueChange={setStatus} style={s.picker}>
                  {STATUSES.map(st => <Picker.Item key={st} label={st} value={st} />)}
                </Picker>
              </View>
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Category</Text>
            <View style={s.pickerWrap}>
              <Picker selectedValue={category} onValueChange={setCategory} style={s.picker}>
                {CATEGORIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
              </Picker>
            </View>
          </View>

          <View style={s.row3}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Due Date</Text>
              <TextInput style={s.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.gray400} />
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Est. Hours</Text>
              <TextInput style={s.input} value={estimatedHours} onChangeText={setEstimatedHours} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.gray400} />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Assignees</Text>
            <View style={s.chipsWrap}>
              {users.map(u => (
                <TouchableOpacity key={u.uid} onPress={() => toggleAssignee(u.uid)}
                  style={[s.chip, assignees.includes(u.uid) && s.chipActive]}>
                  <Text style={[s.chipText, assignees.includes(u.uid) && s.chipTextActive]}>{u.displayName}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Button title={isNew ? 'Create Task' : 'Save Changes'} onPress={save} loading={saving} />

          {!isNew && (
            <>
              <View style={s.divider} />
              <Text style={s.sectionTitle}>Attachments ({attachments.length})</Text>
              {attachments.map(a => (
                <Card key={a.id} padding={12} style={s.attRow}>
                  <Ionicons name="document-attach-outline" size={18} color={Colors.gray500} />
                  <Text style={s.attName} numberOfLines={1}>{a.name}</Text>
                </Card>
              ))}
              <TouchableOpacity style={s.importBtn} onPress={uploadAttachment} disabled={uploading}>
                {uploading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="attach-outline" size={16} color={Colors.primary} />}
                <Text style={s.importBtnText}>{uploading ? 'Uploading…' : 'Add Attachment'}</Text>
              </TouchableOpacity>

              <View style={s.divider} />
              <Text style={s.sectionTitle}>Comments ({comments.length})</Text>
              {comments.map((c, i) => (
                <Card key={i} padding={12} style={{ marginBottom: 8 }}>
                  <Text style={s.commentUser}>{c.user}</Text>
                  <Text style={s.commentText}>{c.text}</Text>
                </Card>
              ))}
              <View style={s.commentInputRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder={`Comment as ${profile?.displayName ?? 'you'}…`}
                  placeholderTextColor={Colors.gray400}
                  value={newComment}
                  onChangeText={setNewComment}
                />
                <TouchableOpacity style={s.sendBtn} onPress={addComment}>
                  <Ionicons name="send" size={18} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </ModalSafeArea>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.gray50 },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4 },
  title:   { fontSize: 17, fontWeight: '700', color: Colors.gray900, flex: 1 },

  content: { padding: 16, paddingBottom: 40 },
  field:   { gap: 6, marginBottom: 14 },
  row3:    { flexDirection: 'row', gap: 12 },
  label:   { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
  input:   { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, fontSize: 14, color: Colors.gray900, backgroundColor: Colors.white },
  textarea:{ height: 90, paddingTop: 10, textAlignVertical: 'top' },
  pickerWrap: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.white },
  picker:  { height: 46 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.gray100, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ backgroundColor: Colors.primaryBg, borderColor: Colors.primary },
  chipText:  { fontSize: 12, fontWeight: '600', color: Colors.gray600 },
  chipTextActive: { color: Colors.primary },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900, marginBottom: 10 },

  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, marginTop: 4 },
  importBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },

  attRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  attName: { flex: 1, fontSize: 13, color: Colors.gray700 },

  commentUser: { fontSize: 12, fontWeight: '700', color: Colors.gray900 },
  commentText: { fontSize: 13, color: Colors.gray700, marginTop: 3 },
  commentInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  sendBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
