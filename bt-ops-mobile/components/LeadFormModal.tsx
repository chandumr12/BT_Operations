import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/Button';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

const GENDERS = ['Male', 'Female', 'Other'];
const ROLES = ['Trek Lead', 'Coordinator', 'Operations Manager'];

interface CreatedCreds { name: string; email: string; password: string; role: string; }

/**
 * Mirrors the web app's "Add New Lead" dialog (frontend/src/pages/
 * LeadManagement.js) — same fields, same POST /leads payload. The backend
 * creates a real Firebase Auth account for the lead when email+password are
 * present, so after a successful save this shows the plaintext credentials
 * once (matching the web's "Login Credentials Created" follow-up dialog)
 * as a second screen inside the SAME <Modal>, rather than stacking a
 * second native Modal.
 */
export function LeadFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [hiredDate, setHiredDate] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Trek Lead');
  const [languages, setLanguages] = useState<string[]>([]);
  const [langDraft, setLangDraft] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedCreds | null>(null);
  const [copied, setCopied] = useState(false);

  const addLanguage = () => {
    const v = langDraft.trim();
    if (!v || languages.includes(v)) return;
    setLanguages(p => [...p, v]); setLangDraft('');
  };
  const removeLanguage = (v: string) => setLanguages(p => p.filter(x => x !== v));

  const addSkill = () => {
    const v = skillDraft.trim();
    if (!v || skills.includes(v)) return;
    setSkills(p => [...p, v]); setSkillDraft('');
  };
  const removeSkill = (v: string) => setSkills(p => p.filter(x => x !== v));

  const save = async () => {
    if (!name.trim() || !phone.trim() || !age.trim() || !hiredDate.trim()) {
      Alert.alert('Missing fields', 'Name, phone, age and hired date are required.'); return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('Login required', 'Email and password are required for new leads.'); return;
    }
    setSaving(true);
    try {
      await api.post('/leads', {
        name: name.trim(),
        phone: phone.trim(),
        age: parseInt(age, 10) || 0,
        gender,
        active,
        hiredDate: hiredDate.trim(),
        languages,
        specialSkills: skills,
        email: email.trim(),
        password,
        role,
      });
      setCreated({ name: name.trim(), email: email.trim(), password, role });
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not create lead');
    } finally { setSaving(false); }
  };

  const copyCreds = async () => {
    if (!created) return;
    await Clipboard.setStringAsync(`Name: ${created.name}\nEmail: ${created.email}\nPassword: ${created.password}\nRole: ${created.role}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name={created ? 'checkmark' : 'person-add'} size={18} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{created ? 'Login Credentials Created' : 'Add New Lead'}</Text>
            <Text style={s.headerSub}>
              {created ? "Copy these before closing — the password won't be shown again." : 'Create a lead profile and login account'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        {created ? (
          <View style={s.credsWrap}>
            <View style={s.credsCard}>
              <CredRow label="Name" value={created.name} />
              <CredRow label="Email" value={created.email} />
              <CredRow label="Password" value={created.password} mono />
              <CredRow label="Role" value={created.role} />
            </View>
            <TouchableOpacity style={[s.copyCredsBtn, copied && s.copyCredsBtnDone]} onPress={copyCreds} activeOpacity={0.85}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={Colors.white} />
              <Text style={s.copyCredsBtnText}>{copied ? 'Copied!' : 'Copy Credentials'}</Text>
            </TouchableOpacity>
            <Button title="Done" onPress={onClose} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
            <View style={s.row2}>
              <Field label="NAME *">
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={Colors.slate400} />
              </Field>
              <Field label="PHONE *">
                <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="10-digit number" keyboardType="phone-pad" placeholderTextColor={Colors.slate400} />
              </Field>
            </View>

            <View style={s.row2}>
              <Field label="AGE *">
                <TextInput style={s.input} value={age} onChangeText={setAge} keyboardType="number-pad" placeholderTextColor={Colors.slate400} />
              </Field>
              <Field label="GENDER *">
                <View style={s.pickerWrap}>
                  <Picker selectedValue={gender} onValueChange={setGender} style={s.picker}>
                    {GENDERS.map(g => <Picker.Item key={g} label={g} value={g} />)}
                  </Picker>
                </View>
              </Field>
            </View>

            <Field label="HIRED DATE *">
              <TextInput style={s.input} value={hiredDate} onChangeText={setHiredDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.slate400} />
            </Field>

            <View style={s.credsSection}>
              <Text style={s.credsSectionTitle}>Login Credentials</Text>
              <Text style={s.credsSectionSub}>Create a login account for this lead.</Text>

              <Field label="EMAIL *">
                <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="lead@example.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={Colors.slate400} />
              </Field>
              <Field label="PASSWORD *">
                <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="Min 6 characters" placeholderTextColor={Colors.slate400} />
              </Field>
              <Field label="ROLE / PERMISSION GROUP">
                <View style={s.pickerWrap}>
                  <Picker selectedValue={role} onValueChange={setRole} style={s.picker}>
                    {ROLES.map(r => <Picker.Item key={r} label={r} value={r} />)}
                  </Picker>
                </View>
              </Field>
            </View>

            <Field label="LANGUAGES KNOWN">
              <View style={s.tagInputRow}>
                <TextInput style={[s.input, { flex: 1 }]} value={langDraft} onChangeText={setLangDraft}
                  placeholder="Type and press Add…" placeholderTextColor={Colors.slate400} onSubmitEditing={addLanguage} />
                <TouchableOpacity style={s.addTagBtn} onPress={addLanguage}><Text style={s.addTagBtnText}>Add</Text></TouchableOpacity>
              </View>
              {languages.length > 0 && (
                <View style={s.tagWrap}>
                  {languages.map(l => (
                    <View key={l} style={s.langTag}>
                      <Text style={s.langTagText}>{l}</Text>
                      <TouchableOpacity onPress={() => removeLanguage(l)} hitSlop={6}>
                        <Ionicons name="close" size={12} color={Colors.gradientBlueTo} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </Field>

            <Field label="SPECIAL SKILLS">
              <View style={s.tagInputRow}>
                <TextInput style={[s.input, { flex: 1 }]} value={skillDraft} onChangeText={setSkillDraft}
                  placeholder="Type and press Add…" placeholderTextColor={Colors.slate400} onSubmitEditing={addSkill} />
                <TouchableOpacity style={s.addTagBtn} onPress={addSkill}><Text style={s.addTagBtnText}>Add</Text></TouchableOpacity>
              </View>
              {skills.length > 0 && (
                <View style={s.tagWrap}>
                  {skills.map(sk => (
                    <View key={sk} style={s.skillTag}>
                      <Text style={s.skillTagText}>{sk}</Text>
                      <TouchableOpacity onPress={() => removeSkill(sk)} hitSlop={6}>
                        <Ionicons name="close" size={12} color="#7c3aed" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </Field>

            <TouchableOpacity style={s.activeRow} onPress={() => setActive(a => !a)} activeOpacity={0.7}>
              <Ionicons name={active ? 'checkbox' : 'square-outline'} size={20} color={active ? Colors.gradientBlueTo : Colors.slate300} />
              <Text style={s.activeLabel}>Active</Text>
            </TouchableOpacity>

            <View style={s.btnRow}>
              <Button title="Save Lead" onPress={save} loading={saving} style={{ flex: 1 }} />
              <Button title="Cancel" onPress={onClose} variant="outline" style={s.cancelBtn} />
            </View>
          </ScrollView>
        )}
      </ModalSafeArea>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

function CredRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.credRow}>
      <Text style={s.credLabel}>{label}</Text>
      <Text style={[s.credValue, mono && s.credValueMono]} selectable>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.slate50 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 16, backgroundColor: Colors.primary,
  },
  headerIcon:  { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 },

  form: { padding: 18, paddingBottom: 40, gap: 16 },

  row2: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 6 },
  label: { fontSize: 10, fontWeight: '800', color: Colors.slate500, letterSpacing: 0.6 },
  input: { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 14, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },

  pickerWrap: { borderWidth: 1.5, borderColor: Colors.slate200, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.white },
  picker: { height: 46 },

  credsSection: { gap: 14, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 14, padding: 14 },
  credsSectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.gradientBlueTo },
  credsSectionSub: { fontSize: 11, color: Colors.slate500, marginTop: -8 },

  tagInputRow: { flexDirection: 'row', gap: 8 },
  addTagBtn: { paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.slate900, alignItems: 'center', justifyContent: 'center' },
  addTagBtnText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  langTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#eff6ff', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  langTagText: { fontSize: 11, fontWeight: '600', color: Colors.gradientBlueTo },
  skillTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f5f3ff', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  skillTagText: { fontSize: 11, fontWeight: '600', color: '#7c3aed' },

  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeLabel: { fontSize: 13, fontWeight: '600', color: Colors.slate700 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.slate100 },
  cancelBtn: { flex: 0, paddingHorizontal: 22 },

  credsWrap: { flex: 1, padding: 20, gap: 14 },
  credsCard: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.slate200, padding: 16, gap: 12 },
  credRow: { gap: 3 },
  credLabel: { fontSize: 10, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.6 },
  credValue: { fontSize: 14, fontWeight: '700', color: Colors.slate900 },
  credValueMono: { fontFamily: 'Courier', letterSpacing: 0.5 },

  copyCredsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13 },
  copyCredsBtnDone: { backgroundColor: Colors.success },
  copyCredsBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});
