import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Mountain, X, CheckCircle } from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LeadSignup = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '', phone: '', age: 25, gender: 'Male',
    hiredDate: '', languages: [], specialSkills: [],
    email: '', password: '', confirmPassword: ''
  });
  const [languageInput, setLanguageInput] = useState('');
  const [skillInput, setSkillInput] = useState('');

  const addLanguage = () => {
    const val = languageInput.trim();
    if (val && !formData.languages.includes(val)) {
      setFormData(f => ({ ...f, languages: [...f.languages, val] }));
      setLanguageInput('');
    }
  };
  const removeLanguage = (lang) => setFormData(f => ({ ...f, languages: f.languages.filter(l => l !== lang) }));

  const addSkill = () => {
    const val = skillInput.trim();
    if (val && !formData.specialSkills.includes(val)) {
      setFormData(f => ({ ...f, specialSkills: [...f.specialSkills, val] }));
      setSkillInput('');
    }
  };
  const removeSkill = (sk) => setFormData(f => ({ ...f, specialSkills: f.specialSkills.filter(s => s !== sk) }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...payload } = formData;
      await axios.post(`${API_URL}/leads/register`, payload);
      setSubmitted(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Application Submitted!</h2>
          <p className="text-slate-500 text-sm mb-6">
            Your application is under review. The admin will approve your account shortly.
            You'll be able to log in once approved.
          </p>
          <Link to="/login">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">Back to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Mountain size={18} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">Bengaluru Trekkers</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">Apply as Trek Lead</h1>
          <p className="text-slate-500 text-sm mt-1">
            Fill in your details below. Your application will be reviewed by the admin.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {/* Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-700 font-medium text-sm">Full Name *</Label>
              <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                required placeholder="Your name" className="mt-1" />
            </div>
            <div>
              <Label className="text-slate-700 font-medium text-sm">Phone *</Label>
              <Input value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                required placeholder="+91 9999999999" className="mt-1" />
            </div>
          </div>

          {/* Age, Gender, Joined Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-slate-700 font-medium text-sm">Age *</Label>
              <Input type="number" min={18} max={70}
                value={formData.age} onChange={e => setFormData(f => ({ ...f, age: parseInt(e.target.value) }))}
                required className="mt-1" />
            </div>
            <div>
              <Label className="text-slate-700 font-medium text-sm">Gender *</Label>
              <Select value={formData.gender} onValueChange={val => setFormData(f => ({ ...f, gender: val }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-700 font-medium text-sm">Start Date *</Label>
              <Input type="date" value={formData.hiredDate}
                onChange={e => setFormData(f => ({ ...f, hiredDate: e.target.value }))}
                required className="mt-1" />
            </div>
          </div>

          {/* Languages */}
          <div>
            <Label className="text-slate-700 font-medium text-sm">Languages Known</Label>
            <div className="flex gap-2 mt-1 mb-2">
              <Input value={languageInput} onChange={e => setLanguageInput(e.target.value)}
                placeholder="e.g. Kannada, Hindi…"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLanguage())} />
              <Button type="button" onClick={addLanguage} variant="outline" className="flex-shrink-0">Add</Button>
            </div>
            {formData.languages.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.languages.map((lang, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                    {lang}
                    <button type="button" onClick={() => removeLanguage(lang)} className="hover:text-red-500"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Special Skills */}
          <div>
            <Label className="text-slate-700 font-medium text-sm">Special Skills</Label>
            <div className="flex gap-2 mt-1 mb-2">
              <Input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                placeholder="e.g. First Aid, Rock Climbing…"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} />
              <Button type="button" onClick={addSkill} variant="outline" className="flex-shrink-0">Add</Button>
            </div>
            {formData.specialSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.specialSkills.map((sk, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                    {sk}
                    <button type="button" onClick={() => removeSkill(sk)} className="hover:text-red-500"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Email & Password */}
          <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-800">Account Credentials</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-700 font-medium text-sm">Email *</Label>
                <Input type="email" value={formData.email}
                  onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                  required placeholder="you@example.com" className="bg-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-700 font-medium text-sm">Password *</Label>
                <Input type="password" value={formData.password}
                  onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                  required placeholder="Min 6 characters" className="bg-white mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-slate-700 font-medium text-sm">Confirm Password *</Label>
              <Input type="password" value={formData.confirmPassword}
                onChange={e => setFormData(f => ({ ...f, confirmPassword: e.target.value }))}
                required placeholder="Re-enter password" className="bg-white mt-1" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 font-semibold">
              {loading ? 'Submitting…' : 'Submit Application'}
            </Button>
            <Link to="/login" className="flex-1">
              <Button type="button" variant="outline" className="w-full">Back to Login</Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadSignup;
