import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin } from 'lucide-react';

const CalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [batches, setBatches] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [batchRes, taskRes] = await Promise.all([
        api.get('/batches/my'),
        api.get('/tickets')
      ]);
      setBatches(Array.isArray(batchRes.data) ? batchRes.data : []);
      setTasks(Array.isArray(taskRes.data) ? taskRes.data : (taskRes.data?.tickets || []));
    } catch { toast.error('Failed to load calendar data'); }
    setLoading(false);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const monthName = currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Build events for each day
  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = [];

    batches.forEach(b => {
      const start = b.startDate?.split('T')[0];
      const end = b.endDate?.split('T')[0];
      if (start && end && dateStr >= start && dateStr <= end) {
        events.push({ type: 'batch', label: b.batchCode, detail: b.trekName, color: 'bg-blue-500' });
      }
    });

    tasks.forEach(t => {
      if (t.dueDate?.split('T')[0] === dateStr) {
        const color = t.priority === 'Urgent' ? 'bg-red-500' : t.priority === 'High' ? 'bg-orange-500' : 'bg-green-500';
        events.push({ type: 'task', label: t.title, detail: t.priority, color });
      }
    });

    return events;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div data-testid="calendar-page" className="space-y-5 md:space-y-6 overflow-hidden">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold heading-font text-slate-900">Calendar</h1>
        <p className="text-slate-600 text-sm mt-1">View your batches and task deadlines</p>
      </div>

      <Card className="border-slate-100 shadow-sm">
        <CardHeader className="border-b border-slate-100 px-3 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100" data-testid="cal-prev">
              <ChevronLeft size={20} className="text-slate-600" />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-base md:text-lg font-bold heading-font text-slate-900">{monthName}</h2>
              {(month !== today.getMonth() || year !== today.getFullYear()) && (
                <button onClick={goToday} className="text-xs text-blue-600 hover:underline" data-testid="cal-today">Today</button>
              )}
            </div>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100" data-testid="cal-next">
              <ChevronRight size={20} className="text-slate-600" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-500 py-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
            {days.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="bg-slate-50 min-h-[60px] md:min-h-[90px]" />;
              const events = getEventsForDay(day);
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              return (
                <div
                  key={day}
                  className={`bg-white min-h-[60px] md:min-h-[90px] p-1 md:p-1.5 ${isToday ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                  data-testid={`cal-day-${day}`}
                >
                  <span className={`text-xs md:text-sm font-medium inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full ${
                    isToday ? 'bg-blue-600 text-white' : 'text-slate-700'
                  }`}>{day}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {events.slice(0, 2).map((ev, i) => (
                      <div key={i} className={`${ev.color} text-white text-[9px] md:text-[10px] leading-tight px-1 py-0.5 rounded truncate`} title={`${ev.label} - ${ev.detail}`}>
                        {ev.type === 'batch' ? '🏔' : '✓'} {ev.label}
                      </div>
                    ))}
                    {events.length > 2 && (
                      <div className="text-[9px] text-slate-500 px-1">+{events.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 px-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded bg-blue-500" /> Trek Batch
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded bg-red-500" /> Urgent Task
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded bg-orange-500" /> High Task
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded bg-green-500" /> Task Due
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming events list */}
      <Card className="border-slate-100 shadow-sm">
        <CardHeader className="border-b border-slate-100 px-3 md:px-6">
          <CardTitle className="heading-font flex items-center gap-2 text-base md:text-lg">
            <CalendarIcon size={18} className="text-blue-600" />
            Upcoming This Month
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="space-y-2">
            {batches.filter(b => {
              const start = new Date(b.startDate);
              return start.getMonth() === month && start.getFullYear() === year;
            }).map(b => (
              <div key={b.id} className="flex items-center gap-3 p-2.5 md:p-3 bg-blue-50 rounded-lg border border-blue-100" data-testid={`cal-batch-${b.batchCode}`}>
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{b.batchCode} - {b.trekName}</p>
                  <p className="text-xs text-slate-600">{new Date(b.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(b.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <Badge className="text-xs bg-blue-100 text-blue-800 flex-shrink-0">{b.myRole}</Badge>
              </div>
            ))}
            {tasks.filter(t => {
              if (!t.dueDate) return false;
              const due = new Date(t.dueDate);
              return due.getMonth() === month && due.getFullYear() === year;
            }).map(t => (
              <div key={t.id} className="flex items-center gap-3 p-2.5 md:p-3 bg-slate-50 rounded-lg border border-slate-200" data-testid={`cal-task-${t.id}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  t.priority === 'Urgent' ? 'bg-red-500' : t.priority === 'High' ? 'bg-orange-500' : 'bg-green-500'
                }`}>
                  <CalendarIcon size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{t.title}</p>
                  <p className="text-xs text-slate-600">Due: {new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <Badge className={`text-xs flex-shrink-0 ${
                  t.priority === 'Urgent' ? 'bg-red-100 text-red-800' : t.priority === 'High' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                }`}>{t.priority}</Badge>
              </div>
            ))}
            {batches.filter(b => { const s = new Date(b.startDate); return s.getMonth() === month && s.getFullYear() === year; }).length === 0 &&
             tasks.filter(t => { if (!t.dueDate) return false; const d = new Date(t.dueDate); return d.getMonth() === month && d.getFullYear() === year; }).length === 0 && (
              <p className="text-center text-slate-500 py-6">No events this month</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarView;
