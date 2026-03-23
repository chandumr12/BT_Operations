import React, { useState, useEffect, useRef } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  MessageSquare, Paperclip, Trash2, Send, Clock, User, Edit, Save,
  CheckCircle, X, ChevronDown, Upload, FileText, Image, Download, Loader2, Calendar
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const statuses    = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
const priorities  = ['Low', 'Medium', 'High', 'Urgent'];
const categories  = ['Operations', 'Sales', 'Content', 'Development', 'Trek Planning'];

/* ── Config maps ── */
const PRIORITY_CONFIG = {
  'Urgent': { bg: 'bg-red-50',    text: 'text-red-700',    ring: 'ring-red-200',    dot: 'bg-red-400'    },
  'High':   { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200', dot: 'bg-orange-400' },
  'Medium': { bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-200',  dot: 'bg-amber-400'  },
  'Low':    { bg: 'bg-slate-50',  text: 'text-slate-500',  ring: 'ring-slate-200',  dot: 'bg-slate-300'  },
};
const STATUS_CONFIG = {
  'Backlog':     { bg: 'bg-slate-50',   text: 'text-slate-600',   ring: 'ring-slate-200',   dot: 'bg-slate-400'   },
  'To Do':       { bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200',    dot: 'bg-blue-400'    },
  'In Progress': { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200',   dot: 'bg-amber-400'   },
  'In Review':   { bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-200',  dot: 'bg-violet-400'  },
  'Done':        { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-400' },
};

const Chip = ({ cfg, label }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
    {label}
  </span>
);

/* ── Rich Text Editor ── */
const RichTextEditor = ({ content, onChange, editable }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content || '',
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== content) editor.commands.setContent(content || '');
  }, [content, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${editable ? 'border-slate-200' : 'border-transparent'}`}>
      {editable && (
        <div className="flex items-center gap-0.5 p-2 border-b border-slate-100 bg-slate-50 flex-wrap" data-testid="rich-text-toolbar">
          {[
            { label: 'B', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), cls: 'font-bold' },
            { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), cls: 'italic' },
            { label: 'S', action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), cls: 'line-through' },
          ].map(({ label, action, active, cls }) => (
            <button key={label} type="button" onClick={action}
              className={`w-7 h-7 rounded-lg text-xs ${cls} ${active ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-500'} transition-colors`}>
              {label}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 mx-1" />
          {[
            { label: '•', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
            { label: '1.', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
            { label: '</>', action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), cls: 'font-mono text-[10px]' },
          ].map(({ label, action, active, cls = '' }) => (
            <button key={label} type="button" onClick={action}
              className={`w-7 h-7 rounded-lg text-xs ${cls} ${active ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-500'} transition-colors`}>
              {label}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 mx-1" />
          {[
            { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
            { label: 'H3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
            { label: '"', action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
          ].map(({ label, action, active }) => (
            <button key={label} type="button" onClick={action}
              className={`w-7 h-7 rounded-lg text-xs font-bold ${active ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-500'} transition-colors`}>
              {label}
            </button>
          ))}
        </div>
      )}
      <EditorContent
        editor={editor}
        className={`prose prose-sm max-w-none p-3 min-h-[80px] focus-within:outline-none ${editable ? 'bg-white' : 'bg-slate-50/60'} [&_.tiptap]:outline-none [&_.tiptap]:min-h-[60px]`}
      />
    </div>
  );
};

/* ── Multi Assignee Select ── */
const MultiAssigneeSelect = ({ selected, onChange, users }) => {
  const [open, setOpen] = useState(false);
  const getUserName = (uid) => users.find(u => u.uid === uid)?.displayName || uid;

  const toggleUser = (uid) => {
    onChange(selected.includes(uid) ? selected.filter(id => id !== uid) : [...selected, uid]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between bg-white text-left font-normal h-auto min-h-[36px] py-1.5 text-sm" data-testid="assignee-multi-select">
          <span className="flex flex-wrap gap-1 flex-1">
            {selected.length === 0
              ? <span className="text-slate-400 text-sm">Select assignees…</span>
              : selected.map(uid => (
                  <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                    {getUserName(uid)}
                  </span>
                ))
            }
          </span>
          <ChevronDown size={14} className="text-slate-400 flex-shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-white" align="start">
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {users.map(user => (
            <label key={user.uid} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
              <Checkbox checked={selected.includes(user.uid)} onCheckedChange={() => toggleUser(user.uid)} />
              <span className="text-sm text-slate-900">{user.displayName}</span>
            </label>
          ))}
          {users.length === 0 && <p className="text-sm text-slate-400 p-2">No users available</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* ── Attachment Section ── */
const AttachmentSection = ({ ticketId, attachments, onRefresh }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large (max 10MB)'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/tickets/${ticketId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('File uploaded');
      onRefresh();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDownload = async (att) => {
    setDownloadingId(att.id);
    try {
      const res = await api.get(`/attachments/${att.id}?ticket_id=${ticketId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = att.name; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
    finally { setDownloadingId(null); }
  };

  const handleRemove = async (att) => {
    if (!window.confirm(`Remove "${att.name}"?`)) return;
    try {
      await api.delete(`/tickets/${ticketId}/attachments/${att.id}`);
      toast.success('Attachment removed'); onRefresh();
    } catch { toast.error('Failed to remove attachment'); }
  };

  const formatSize = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
  const fileIcon = (ct) => ct?.startsWith('image/') ? <Image size={14} className="text-blue-500" /> : <FileText size={14} className="text-slate-400" />;

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Paperclip size={12} /> Attachments ({attachments.length})
      </h3>
      <div className="border-2 border-dashed border-slate-100 rounded-xl p-3 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors mb-2"
        onClick={() => !uploading && fileInputRef.current?.click()} data-testid="attachment-upload-area">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} data-testid="attachment-file-input" />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-0.5">
            <Loader2 size={14} className="animate-spin text-blue-500" />
            <span className="text-xs text-blue-500">Uploading…</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-0.5">
            <Upload size={14} className="text-slate-300" />
            <span className="text-xs text-slate-400">Click to upload (max 10MB)</span>
          </div>
        )}
      </div>
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-xl group" data-testid={`attachment-${att.id}`}>
              {fileIcon(att.contentType)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{att.name}</p>
                <p className="text-[10px] text-slate-400">{formatSize(att.size)} · {att.uploadedBy}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleDownload(att)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors" title="Download" data-testid={`download-attachment-${att.id}`}>
                  {downloadingId === att.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                </button>
                <button onClick={() => handleRemove(att)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 transition-colors" title="Remove" data-testid={`remove-attachment-${att.id}`}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main Dialog ── */
const TicketDetailsDialog = ({ ticket, open, onClose, onRefresh, onDelete, users, initialEditMode = false }) => {
  const { userProfile } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [fullTicket, setFullTicket] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    if (open && ticket) { loadFullTicket(); setIsEditing(initialEditMode); }
    if (!open) { setFullTicket(null); setIsEditing(false); setEditData({}); }
  }, [open, ticket, initialEditMode]);

  const loadFullTicket = async () => {
    try {
      const res = await api.get(`/tickets/${ticket.id}`);
      setFullTicket(res.data);
      initEditData(res.data);
    } catch { toast.error('Failed to load ticket details'); }
  };

  const initEditData = (t) => setEditData({
    title: t.title || '', description: t.description || '',
    priority: t.priority || 'Medium', status: t.status || 'Backlog',
    category: t.category || 'Operations', assignees: t.assignees || [],
    dueDate: t.dueDate || '', estimatedHours: t.estimatedHours || '',
  });

  const handleSave = async () => {
    if (!editData.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      await api.patch(`/tickets/${fullTicket.id}`, {
        ...editData,
        estimatedHours: editData.estimatedHours ? parseInt(editData.estimatedHours) : null,
      });
      toast.success('Task updated');
      setIsEditing(false);
      loadFullTicket();
      onRefresh?.();
    } catch { toast.error('Failed to update task'); }
    finally { setSaving(false); }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      await api.post(`/tickets/${fullTicket.id}/comments`, { text: commentText });
      setCommentText('');
      toast.success('Comment added');
      loadFullTicket();
    } catch { toast.error('Failed to add comment'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await api.delete(`/tickets/${fullTicket.id}`);
      toast.success('Task deleted');
      onDelete?.(fullTicket.id);
      onClose();
    } catch { toast.error('Failed to delete task'); }
  };

  const getUserName = (uid) => users.find(u => u.uid === uid)?.displayName || 'Unknown';

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  /* ── Loading state ── */
  if (!fullTicket) {
    if (!open) return null;
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl bg-white rounded-2xl">
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="text-xs text-slate-400">Loading task…</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const pc = PRIORITY_CONFIG[fullTicket.priority] || PRIORITY_CONFIG['Low'];
  const sc = STATUS_CONFIG[fullTicket.status] || STATUS_CONFIG['Backlog'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white p-0" data-testid="ticket-details-dialog">

        {/* ── Dialog Header — gradient strip ── */}
        <div className="relative overflow-hidden flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)' }}>
          <div className="absolute top-0 right-0 w-48 h-48 opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
          <div className="relative pl-5 pr-12 pt-5 pb-4">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="text-base font-bold bg-white/10 border-white/20 text-white placeholder:text-blue-200 focus:bg-white/20"
                    placeholder="Task title"
                    data-testid="edit-title-input"
                  />
                ) : (
                  <DialogTitle className="text-white text-xl font-bold leading-tight" data-testid="ticket-title">
                    {fullTicket.title}
                  </DialogTitle>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isEditing ? (
                  <>
                    <Button onClick={handleSave} disabled={saving} size="sm"
                      className="h-7 px-3 text-xs bg-white text-blue-700 hover:bg-blue-50 gap-1" data-testid="save-task-btn">
                      <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button size="sm"
                      onClick={() => { setIsEditing(false); initEditData(fullTicket); }}
                      className="h-7 px-3 text-xs bg-white/10 text-white hover:bg-white/20 border-0 gap-1" data-testid="cancel-edit-btn">
                      <X size={12} /> Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={() => setIsEditing(true)}
                      className="h-7 px-3 text-xs bg-white/10 text-white hover:bg-white/20 border-0 gap-1" data-testid="edit-task-btn">
                      <Edit size={12} /> Edit
                    </Button>
                    <Button size="sm" onClick={handleDelete}
                      className="h-7 px-3 text-xs bg-white/10 text-red-200 hover:bg-red-500/30 hover:text-white border-0 gap-1" data-testid="delete-task-btn">
                      <Trash2 size={12} /> Delete
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Chips row — view mode */}
            {!isEditing && (
              <div className="flex items-center gap-2 flex-wrap">
                <Chip cfg={pc} label={fullTicket.priority} />
                <Chip cfg={sc} label={fullTicket.status} />
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 bg-blue-50 text-blue-600 ring-blue-100">
                  {fullTicket.category}
                </span>
              </div>
            )}

            {/* Edit fields row — edit mode */}
            {isEditing && (
              <div className="grid grid-cols-3 gap-2.5 mt-1" data-testid="edit-fields-row">
                <div>
                  <Label className="text-[10px] text-blue-200 uppercase tracking-wide mb-1 block">Priority</Label>
                  <Select value={editData.priority} onValueChange={(val) => setEditData({ ...editData, priority: val })}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-8 text-xs [&>span]:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">{priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-blue-200 uppercase tracking-wide mb-1 block">Status</Label>
                  <Select value={editData.status} onValueChange={(val) => setEditData({ ...editData, status: val })}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-8 text-xs [&>span]:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-blue-200 uppercase tracking-wide mb-1 block">Category</Label>
                  <Select value={editData.category} onValueChange={(val) => setEditData({ ...editData, category: val })}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-8 text-xs [&>span]:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-3 gap-0 divide-x divide-slate-100">

            {/* ── Main content (2/3) ── */}
            <div className="col-span-2 p-5 space-y-5">

              {/* Description */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  Description
                </h3>
                {isEditing ? (
                  <RichTextEditor
                    content={editData.description}
                    onChange={(html) => setEditData({ ...editData, description: html })}
                    editable={true}
                  />
                ) : fullTicket.description ? (
                  <div
                    className="bg-slate-50/60 rounded-xl p-4 prose prose-sm max-w-none text-slate-700 border border-slate-100"
                    dangerouslySetInnerHTML={{ __html: fullTicket.description }}
                    data-testid="ticket-description"
                  />
                ) : (
                  <p className="text-slate-400 italic text-sm bg-slate-50/60 rounded-xl p-4 border border-slate-100">No description provided</p>
                )}
              </div>

              {/* Activity log */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Clock size={11} /> Activity
                </h3>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {fullTicket.activityLog?.length > 0 ? (
                    fullTicket.activityLog.map((a, i) => (
                      <div key={i} className="flex gap-3 py-2 border-b border-slate-50 last:border-0">
                        <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle size={11} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-600">
                            <span className="font-semibold text-slate-800">{a.user}</span>{' '}{a.action}
                            {a.from && a.to && (
                              <> from <span className="font-medium text-slate-700">{a.from}</span>
                              {' → '}<span className="font-medium text-slate-700">{a.to}</span></>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatTimestamp(a.timestamp)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-xs italic py-2">No activity yet</p>
                  )}
                </div>
              </div>

              {/* Comments */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MessageSquare size={11} /> Comments ({fullTicket.comments?.length || 0})
                </h3>

                {/* Comment input */}
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Add a comment…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    className="bg-slate-50 border-slate-200 text-sm h-8 focus:bg-white"
                    data-testid="comment-input"
                  />
                  <Button onClick={handleAddComment} size="sm"
                    className="h-8 px-3 bg-blue-600 hover:bg-blue-700 flex-shrink-0" data-testid="send-comment-btn">
                    <Send size={13} />
                  </Button>
                </div>

                {/* Comment list */}
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {fullTicket.comments?.length > 0 ? (
                    fullTicket.comments.map((c, i) => (
                      <div key={i} className="flex gap-2.5 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                          {c.user?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-slate-800 text-xs">{c.user}</span>
                            <span className="text-[10px] text-slate-400">{formatTimestamp(c.timestamp)}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{c.text}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-xs italic py-2">No comments yet</p>
                  )}
                </div>
              </div>

              {/* Attachments */}
              <AttachmentSection ticketId={fullTicket.id} attachments={fullTicket.attachments || []} onRefresh={loadFullTicket} />
            </div>

            {/* ── Sidebar (1/3) ── */}
            <div className="p-4 space-y-4 bg-slate-50/40">

              {/* Assigned To */}
              <div>
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User size={11} /> Assigned To
                </h4>
                {isEditing ? (
                  <MultiAssigneeSelect
                    selected={editData.assignees}
                    onChange={(val) => setEditData({ ...editData, assignees: val })}
                    users={users}
                  />
                ) : (
                  <div className="space-y-2" data-testid="assignees-list">
                    {fullTicket.assignees?.length > 0 ? (
                      fullTicket.assignees.map((uid, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
                          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {getUserName(uid).charAt(0)}
                          </div>
                          <span className="text-xs text-slate-700 font-medium truncate">{getUserName(uid)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">Not assigned</p>
                    )}
                  </div>
                )}
              </div>

              <div className="w-full h-px bg-slate-100" />

              {/* Due Date */}
              <div>
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar size={11} /> Due Date
                </h4>
                {isEditing ? (
                  <Input type="date" value={editData.dueDate}
                    onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                    className="bg-white h-8 text-xs" data-testid="edit-due-date" />
                ) : (
                  <p className="text-xs text-slate-800 font-medium">
                    {fullTicket.dueDate
                      ? new Date(fullTicket.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                      : <span className="text-slate-400 italic">No due date</span>}
                  </p>
                )}
              </div>

              {/* Estimated Hours */}
              <div>
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock size={11} /> Est. Hours
                </h4>
                {isEditing ? (
                  <Input type="number" value={editData.estimatedHours}
                    onChange={(e) => setEditData({ ...editData, estimatedHours: e.target.value })}
                    className="bg-white h-8 text-xs" placeholder="Hours" data-testid="edit-estimated-hours" />
                ) : (
                  <p className="text-xs text-slate-800 font-medium">
                    {fullTicket.estimatedHours
                      ? `${fullTicket.estimatedHours}h`
                      : <span className="text-slate-400 italic">Not set</span>}
                  </p>
                )}
              </div>

              <div className="w-full h-px bg-slate-100" />

              {/* Reporter */}
              <div>
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Reporter</h4>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {(fullTicket.reporter || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-700 font-medium">{fullTicket.reporter || 'Unknown'}</span>
                </div>
              </div>

              <div className="w-full h-px bg-slate-100" />

              {/* Timestamps */}
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Created</p>
                  <p className="text-[11px] text-slate-600 font-medium">{formatTimestamp(fullTicket.createdAt)}</p>
                </div>
                {fullTicket.updatedAt && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Last Updated</p>
                    <p className="text-[11px] text-slate-600 font-medium">{formatTimestamp(fullTicket.updatedAt)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TicketDetailsDialog;