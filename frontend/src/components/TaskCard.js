import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Trash2, User, Calendar } from 'lucide-react';
import api from '@/utils/api';
import { toast } from 'sonner';

const TaskCard = ({ ticket, onClick, onDelete, getPriorityColor, getCategoryColor, getAssigneeNames }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    
    if (!window.confirm(`Delete task "${ticket.title}"?`)) return;
    
    setIsDeleting(true);
    try {
      await api.delete(`/tickets/${ticket.id}`);
      toast.success('Task deleted');
      onDelete(ticket.id);
    } catch (error) {
      toast.error('Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onClick(ticket);
  };

  return (
    <Card 
      className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer card-hover relative group"
      onClick={() => onClick(ticket)}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-slate-900 text-sm line-clamp-2 flex-1">
            {ticket.title}
          </h4>
          <div className="flex items-center gap-1">
            <Badge className={`text-xs ${getPriorityColor(ticket.priority)}`}>
              {ticket.priority}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <DropdownMenuItem onClick={handleEdit} className="cursor-pointer">
                  <Edit size={14} className="mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDelete} 
                  className="cursor-pointer text-red-600"
                  disabled={isDeleting}
                >
                  <Trash2 size={14} className="mr-2" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className={`text-xs ${getCategoryColor(ticket.category)}`}>
            {ticket.category}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1">
            <User size={12} />
            <span>{getAssigneeNames(ticket.assignees)}</span>
          </div>
          {ticket.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar size={12} />
              <span>{new Date(ticket.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskCard;
