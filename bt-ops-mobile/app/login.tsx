import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Button } from '@/components/Button';
import api from '@/utils/api';

type Tab = 'login' | 'signup';

// Same hero photo as the web login page (frontend/src/pages/Login.js).
const HERO_IMAGE = 'https://images.unsplash.com/photo-1644047578814-1814a382f092?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwzfHxtb3VudGFpbiUyMHRyZWtraW5nJTIwbGFuZHNjYXBlJTIwaGltYWxheWFzfGVufDB8fHx8MTc3MTk4OTE1N3ww&ixlib=rb-4.1.0&q=85';

/** Password input with a show/hide eye toggle. */
function PasswordField({
  label, value, onChangeText, placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.pwWrap}>
        <TextInput
          style={s.pwInput}
          placeholder={placeholder ?? '••••••••'}
          placeholderTextColor={Colors.gray400}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={s.eyeBtn}
          onPress={() => setVisible(v => !v)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={Colors.gray500}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { login, signup, resetPassword } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // Sign up fields
  const [name,            setName]            = useState('');
  const [signupEmail,     setSignupEmail]     = useState('');
  const [signupPassword,  setSignupPassword]  = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Forgot password
  const [showForgot,  setShowForgot]  = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent,  setForgotSent]  = useState(false);

  // Apply as Trek Lead
  const [showApply, setShowApply] = useState(false);
  const [applySubmitted, setApplySubmitted] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      const msg = e.code === 'auth/invalid-credential'
        ? 'Invalid email or password.'
        : e.message ?? 'Login failed.';
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!name.trim() || !signupEmail.trim() || !signupPassword) {
      Alert.alert('Missing fields', 'Fill in your name, email, and password.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter your password.');
      return;
    }
    if (signupPassword.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signup(signupEmail.trim(), signupPassword, name.trim());
      Alert.alert('Account created', 'Your account is pending admin approval. You’ll get access once approved.');
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.message ?? 'Failed to create account.';
      Alert.alert('Sign up failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert('Missing email', 'Enter the email address for your account.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(forgotEmail.trim());
      setForgotSent(true);
    } catch (e: any) {
      const msg = e.code === 'auth/user-not-found'
        ? 'No account found with this email.'
        : e.message ?? 'Failed to send reset email.';
      Alert.alert('Could not send reset link', msg);
    } finally {
      setLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotSent(false);
    setForgotEmail('');
  };

  if (showApply) {
    return (
      <LeadApplyForm
        submitted={applySubmitted}
        onSubmitted={() => setApplySubmitted(true)}
        onClose={() => { setShowApply(false); setApplySubmitted(false); }}
      />
    );
  }

  return (
    <ImageBackground source={{ uri: HERO_IMAGE }} style={s.bg} resizeMode="cover">
      <View style={s.overlay} />
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        // Lets the focused input scroll clear of the keyboard instead of
        // sitting underneath it.
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>BT</Text>
          </View>
          <Text style={s.title}>Bengaluru Trekkers</Text>
          <Text style={s.subtitle}>Operations Portal</Text>
        </View>

        {/* Form Card */}
        <View style={s.card}>

          {showForgot ? (
            /* ── Forgot password ─────────────────────────────────── */
            <>
              <TouchableOpacity style={s.backRow} onPress={closeForgot}>
                <Ionicons name="arrow-back" size={15} color={Colors.gray500} />
                <Text style={s.backText}>Back to Login</Text>
              </TouchableOpacity>

              {forgotSent ? (
                <View style={s.sentBox}>
                  <View style={s.sentIcon}>
                    <Ionicons name="mail-outline" size={26} color={Colors.success} />
                  </View>
                  <Text style={s.sentTitle}>Check your inbox</Text>
                  <Text style={s.sentBody}>
                    A password reset link has been sent to{' '}
                    <Text style={s.sentEmail}>{forgotEmail}</Text>. Open it to set a
                    new password, then come back and sign in.
                  </Text>
                  <TouchableOpacity onPress={closeForgot}>
                    <Text style={s.sentLink}>Back to Login</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={s.cardTitle}>Reset Password</Text>
                  <Text style={s.cardSub}>
                    We’ll email you a link to set a new password.
                  </Text>

                  <View style={s.field}>
                    <Text style={s.label}>Email address</Text>
                    <TextInput
                      style={s.input}
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.gray400}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      autoFocus
                    />
                  </View>

                  <Button
                    title="Send Reset Link"
                    onPress={handleForgot}
                    loading={loading}
                    style={s.btn}
                  />
                </>
              )}
            </>
          ) : (
            /* ── Login / Sign up ─────────────────────────────────── */
            <>
              <View style={s.tabRow}>
                <TouchableOpacity
                  style={[s.tabBtn, tab === 'login' && s.tabBtnActive]}
                  onPress={() => setTab('login')}
                >
                  <Text style={[s.tabLabel, tab === 'login' && s.tabLabelActive]}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.tabBtn, tab === 'signup' && s.tabBtnActive]}
                  onPress={() => setTab('signup')}
                >
                  <Text style={[s.tabLabel, tab === 'signup' && s.tabLabelActive]}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {tab === 'login' ? (
                <>
                  <View style={s.field}>
                    <Text style={s.label}>Email</Text>
                    <TextInput
                      style={s.input}
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.gray400}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>

                  <PasswordField
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                  />

                  <TouchableOpacity
                    style={s.forgotRow}
                    onPress={() => { setForgotEmail(email); setShowForgot(true); }}
                  >
                    <Text style={s.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>

                  <Button
                    title="Sign in"
                    onPress={handleLogin}
                    loading={loading}
                    style={s.btn}
                  />
                </>
              ) : (
                <>
                  <View style={s.field}>
                    <Text style={s.label}>Full Name</Text>
                    <TextInput
                      style={s.input}
                      placeholder="John Doe"
                      placeholderTextColor={Colors.gray400}
                      value={name}
                      onChangeText={setName}
                      autoComplete="name"
                    />
                  </View>

                  <View style={s.field}>
                    <Text style={s.label}>Email</Text>
                    <TextInput
                      style={s.input}
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.gray400}
                      value={signupEmail}
                      onChangeText={setSignupEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>

                  <PasswordField
                    label="Password"
                    value={signupPassword}
                    onChangeText={setSignupPassword}
                    placeholder="Min 6 characters"
                  />

                  <PasswordField
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter password"
                  />

                  <Button
                    title="Sign Up"
                    onPress={handleSignup}
                    loading={loading}
                    style={s.btn}
                  />

                  <Text style={s.note}>
                    Registering requires admin approval before you can log in.
                  </Text>
                </>
              )}
            </>
          )}
        </View>

        {!showForgot && (
          <TouchableOpacity onPress={() => setShowApply(true)} style={s.applyRow}>
            <Text style={s.applyText}>
              Want to join as a Trek Lead? <Text style={s.applyLink}>Apply here</Text>
            </Text>
          </TouchableOpacity>
        )}

        <Text style={s.footer}>BT Ops v1.0  •  Bengaluru Trekkers</Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

/* ───────────────────────── Apply as Trek Lead ───────────────────────── */

interface LangSkillInputProps {
  label: string; placeholder: string; items: string[];
  input: string; setInput: (v: string) => void; onAdd: () => void; onRemove: (i: number) => void;
}
function TagListField({ label, placeholder, items, input, setInput, onAdd, onRemove }: LangSkillInputProps) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.tagAddRow}>
        <TextInput
          style={[s.input, { flex: 1 }]} placeholder={placeholder} placeholderTextColor={Colors.gray400}
          value={input} onChangeText={setInput} onSubmitEditing={onAdd}
        />
        <TouchableOpacity style={s.tagAddBtn} onPress={onAdd}>
          <Text style={s.tagAddBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      {items.length > 0 && (
        <View style={s.tagWrap}>
          {items.map((item, i) => (
            <View key={i} style={s.tag}>
              <Text style={s.tagText}>{item}</Text>
              <TouchableOpacity onPress={() => onRemove(i)}>
                <Ionicons name="close" size={11} color={Colors.gray400} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function LeadApplyForm({ submitted, onSubmitted, onClose }: { submitted: boolean; onSubmitted: () => void; onClose: () => void }) {
  const [applyName,   setApplyName]   = useState('');
  const [phone,       setPhone]       = useState('');
  const [age,         setAge]         = useState('25');
  const [gender,      setGender]      = useState('Male');
  const [hiredDate,   setHiredDate]   = useState('');
  const [languages,   setLanguages]   = useState<string[]>([]);
  const [langInput,   setLangInput]   = useState('');
  const [skills,      setSkills]      = useState<string[]>([]);
  const [skillInput,  setSkillInput]  = useState('');
  const [applyEmail,    setApplyEmail]    = useState('');
  const [applyPassword, setApplyPassword] = useState('');
  const [applyConfirm,  setApplyConfirm]  = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addLanguage = () => {
    const v = langInput.trim();
    if (v && !languages.includes(v)) { setLanguages(l => [...l, v]); setLangInput(''); }
  };
  const addSkill = () => {
    const v = skillInput.trim();
    if (v && !skills.includes(v)) { setSkills(k => [...k, v]); setSkillInput(''); }
  };

  const submit = async () => {
    if (!applyName.trim() || !phone.trim() || !hiredDate.trim() || !applyEmail.trim() || !applyPassword) {
      Alert.alert('Missing fields', 'Fill in name, phone, start date, email and password.');
      return;
    }
    if (applyPassword !== applyConfirm) {
      Alert.alert('Passwords do not match', 'Please re-enter your password.');
      return;
    }
    if (applyPassword.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      // Mirrors the web app's LeadSignup.js — same backend endpoint, same
      // pending-approval flow surfaced in User Management.
      await api.post('/leads/register', {
        name: applyName.trim(), phone: phone.trim(), age: parseInt(age, 10) || 0, gender,
        hiredDate, languages, specialSkills: skills, email: applyEmail.trim(), password: applyPassword,
      });
      onSubmitted();
    } catch (e: any) {
      Alert.alert('Submission failed', e.response?.data?.detail ?? 'Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <View style={s.applyRoot}>
      <ScrollView contentContainerStyle={s.applyScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.applyHeaderRow}>
          <View style={s.logoBoxSmall}><Text style={s.logoTextSmall}>BT</Text></View>
          <Text style={s.applyBrand}>Bengaluru Trekkers</Text>
        </View>

        {submitted ? (
          <View style={s.applyDoneCard}>
            <View style={s.applyDoneIcon}><Ionicons name="checkmark-circle" size={34} color={Colors.success} /></View>
            <Text style={s.applyDoneTitle}>Application Submitted!</Text>
            <Text style={s.applyDoneBody}>
              Your application is under review. The admin will approve your account shortly.
              You'll be able to log in once approved.
            </Text>
            <Button title="Back to Login" onPress={onClose} style={{ marginTop: 8 }} />
          </View>
        ) : (
          <View style={s.applyCard}>
            <Text style={s.applyTitle}>Apply as Trek Lead</Text>
            <Text style={s.applySub}>Fill in your details below. Your application will be reviewed by the admin.</Text>

            <View style={s.field}><Text style={s.label}>Full Name *</Text>
              <TextInput style={s.input} value={applyName} onChangeText={setApplyName} placeholder="Your name" placeholderTextColor={Colors.gray400} /></View>
            <View style={s.field}><Text style={s.label}>Phone *</Text>
              <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+91 9999999999" keyboardType="phone-pad" placeholderTextColor={Colors.gray400} /></View>

            <View style={s.row2}>
              <View style={[s.field, { flex: 1 }]}><Text style={s.label}>Age *</Text>
                <TextInput style={s.input} value={age} onChangeText={setAge} keyboardType="number-pad" placeholderTextColor={Colors.gray400} /></View>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Gender *</Text>
                <View style={s.genderRow}>
                  {['Male', 'Female', 'Other'].map(g => (
                    <TouchableOpacity key={g} onPress={() => setGender(g)} style={[s.genderBtn, gender === g && s.genderBtnActive]}>
                      <Text style={[s.genderBtnText, gender === g && s.genderBtnTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View style={s.field}><Text style={s.label}>Start Date * (YYYY-MM-DD)</Text>
              <TextInput style={s.input} value={hiredDate} onChangeText={setHiredDate} placeholder="2026-08-01" placeholderTextColor={Colors.gray400} /></View>

            <TagListField label="Languages Known" placeholder="e.g. Kannada, Hindi…"
              items={languages} input={langInput} setInput={setLangInput} onAdd={addLanguage} onRemove={(i) => setLanguages(l => l.filter((_, idx) => idx !== i))} />
            <TagListField label="Special Skills" placeholder="e.g. First Aid, Rock Climbing…"
              items={skills} input={skillInput} setInput={setSkillInput} onAdd={addSkill} onRemove={(i) => setSkills(k => k.filter((_, idx) => idx !== i))} />

            <View style={s.credBox}>
              <Text style={s.credTitle}>Account Credentials</Text>
              <View style={s.field}><Text style={s.label}>Email *</Text>
                <TextInput style={s.input} value={applyEmail} onChangeText={setApplyEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.gray400} /></View>
              <View style={s.field}><Text style={s.label}>Password *</Text>
                <TextInput style={s.input} value={applyPassword} onChangeText={setApplyPassword} placeholder="Min 6 characters" secureTextEntry placeholderTextColor={Colors.gray400} /></View>
              <View style={s.field}><Text style={s.label}>Confirm Password *</Text>
                <TextInput style={s.input} value={applyConfirm} onChangeText={setApplyConfirm} placeholder="Re-enter password" secureTextEntry placeholderTextColor={Colors.gray400} /></View>
            </View>

            <View style={s.applyBtnRow}>
              <Button title={submitting ? 'Submitting…' : 'Submit Application'} onPress={submit} loading={submitting} style={{ flex: 1 }} />
              <Button title="Back to Login" onPress={onClose} variant="outline" style={{ paddingHorizontal: 18 }} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bg:      { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.72)' },
  root:     { flex: 1, backgroundColor: 'transparent' },
  scroll:   { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 24 },

  applyRow:  { alignItems: 'center' },
  applyText: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  applyLink: { fontWeight: '700', color: Colors.white, textDecorationLine: 'underline' },

  header:   { alignItems: 'center', gap: 10 },
  logoBox:  {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 28, fontWeight: '800', color: Colors.white },
  title:    { fontSize: 22, fontWeight: '700', color: Colors.white },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },

  card:      {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray900 },
  cardSub:   { fontSize: 13, color: Colors.gray500, marginTop: -10 },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabLabel: { fontSize: 14, fontWeight: '600', color: Colors.gray500 },
  tabLabelActive: { color: Colors.gray900 },

  field:  { gap: 6 },
  label:  { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
  input:  {
    height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, fontSize: 15,
    color: Colors.gray900, backgroundColor: Colors.gray50,
  },

  pwWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.gray50,
    paddingRight: 6,
  },
  pwInput: {
    flex: 1, height: '100%',
    paddingHorizontal: 14, fontSize: 15,
    color: Colors.gray900,
  },
  eyeBtn: { paddingHorizontal: 8, paddingVertical: 6 },

  forgotRow:  { alignSelf: 'flex-end', marginTop: -8 },
  forgotText: { fontSize: 12.5, fontWeight: '600', color: Colors.primary },

  backRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  backText: { fontSize: 13, color: Colors.gray500, fontWeight: '500' },

  sentBox:   { alignItems: 'center', gap: 10, paddingVertical: 12 },
  sentIcon:  {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.successBg,
    alignItems: 'center', justifyContent: 'center',
  },
  sentTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray900 },
  sentBody:  { fontSize: 13, color: Colors.gray500, textAlign: 'center', lineHeight: 19 },
  sentEmail: { fontWeight: '700', color: Colors.gray700 },
  sentLink:  { fontSize: 13.5, fontWeight: '600', color: Colors.primary, marginTop: 4 },

  btn:    { marginTop: 4 },
  note:   { fontSize: 12, color: Colors.gray500, textAlign: 'center', marginTop: -6 },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  row2: { flexDirection: 'row', gap: 12 },

  /* ── Apply as Trek Lead ── */
  applyRoot:   { flex: 1, backgroundColor: Colors.gray100 },
  applyScroll: { flexGrow: 1, padding: 20, paddingTop: 60, paddingBottom: 40 },
  applyHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18, alignSelf: 'center' },
  logoBoxSmall: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoTextSmall: { fontSize: 13, fontWeight: '800', color: Colors.white },
  applyBrand: { fontSize: 16, fontWeight: '800', color: Colors.gray900 },

  applyCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 22, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 6,
  },
  applyTitle: { fontSize: 20, fontWeight: '800', color: Colors.gray900, marginBottom: 4 },
  applySub:   { fontSize: 13, color: Colors.gray500, marginBottom: 16 },

  tagAddRow:  { flexDirection: 'row', gap: 8 },
  tagAddBtn:  { paddingHorizontal: 16, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  tagAddBtnText: { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
  tagWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.infoBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tagText:    { fontSize: 11, fontWeight: '600', color: Colors.info },

  genderRow: { flexDirection: 'row', gap: 6 },
  genderBtn: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  genderBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  genderBtnText: { fontSize: 11, fontWeight: '600', color: Colors.gray600 },
  genderBtnTextActive: { color: Colors.white },

  credBox:   { backgroundColor: Colors.infoBg, borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 14, padding: 14, gap: 4, marginTop: 4, marginBottom: 6 },
  credTitle: { fontSize: 13, fontWeight: '700', color: Colors.info, marginBottom: 6 },

  applyBtnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },

  applyDoneCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 28, alignItems: 'center', gap: 6 },
  applyDoneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  applyDoneTitle: { fontSize: 17, fontWeight: '800', color: Colors.gray900 },
  applyDoneBody:  { fontSize: 13, color: Colors.gray500, textAlign: 'center', lineHeight: 19, marginBottom: 8 },
});
