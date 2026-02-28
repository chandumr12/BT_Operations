import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Trash2 } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) { toast.error('Failed to fetch users'); }
    finally { setLoading(false); }
  };

  const handleApprove = async (uid) => {
    try { await api.patch(`/users/${uid}/approve`); toast.success('User approved'); fetchUsers(); }
    catch { toast.error('Failed to approve user'); }
  };

  const handleRoleChange = async (uid, newRole) => {
    try { await api.patch(`/users/${uid}/role?role=${encodeURIComponent(newRole)}`); toast.success('Role updated'); fetchUsers(); }
    catch { toast.error('Failed to update role'); }
  };

  const handleDelete = async (uid) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try { await api.delete(`/users/${uid}`); toast.success('User deleted'); fetchUsers(); }
    catch { toast.error('Failed to delete user'); }
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = users.filter(u => u.status === 'approved');

  return (
    <div data-testid="user-management-page" className="space-y-5 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold heading-font text-slate-900">User Management</h1>
        <p className="text-slate-600 text-sm mt-1">Approve users and manage roles</p>
      </div>

      {pendingUsers.length > 0 && (
        <div>
          <h2 className="text-lg md:text-xl font-bold heading-font mb-3 flex items-center gap-2">
            <span className="bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full text-sm">{pendingUsers.length}</span>
            Pending Approvals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {pendingUsers.map((user) => (
              <Card key={user.uid} data-testid={`pending-user-${user.uid}`} className="border-orange-200 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-slate-900">{user.displayName}</p>
                    <p className="text-sm text-slate-600 truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">Pending</Badge>
                    <p className="text-xs text-slate-500">{new Date(user.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button data-testid={`approve-user-${user.uid}`} onClick={() => handleApprove(user.uid)} className="flex-1 bg-green-600 hover:bg-green-700" size="sm">
                      <CheckCircle size={14} className="mr-1.5" /> Approve
                    </Button>
                    <Button data-testid={`reject-user-${user.uid}`} onClick={() => handleDelete(user.uid)} variant="outline" className="text-red-600 hover:text-red-700" size="sm">
                      <XCircle size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg md:text-xl font-bold heading-font mb-3">Approved Users</h2>
        {loading ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {approvedUsers.map((user) => (
              <Card key={user.uid} data-testid={`approved-user-${user.uid}`} className="border-slate-100 shadow-sm">
                <CardContent className="p-3 md:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm md:text-lg flex-shrink-0">
                        {user.displayName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 text-sm md:text-base truncate">{user.displayName}</p>
                        <p className="text-xs md:text-sm text-slate-600 truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-12 sm:pl-0">
                      <Select value={user.role} onValueChange={(newRole) => handleRoleChange(user.uid, newRole)}>
                        <SelectTrigger data-testid={`role-select-${user.uid}`} className="w-full sm:w-44 h-8 md:h-9 text-xs md:text-sm bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="Super Admin">Super Admin</SelectItem>
                          <SelectItem value="Operations Manager">Ops Manager</SelectItem>
                          <SelectItem value="Coordinator">Coordinator</SelectItem>
                          <SelectItem value="Trek Lead">Trek Lead</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button data-testid={`delete-user-${user.uid}`} variant="outline" size="icon" onClick={() => handleDelete(user.uid)} className="text-red-600 hover:text-red-700 h-8 w-8 md:h-9 md:w-9 flex-shrink-0">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
