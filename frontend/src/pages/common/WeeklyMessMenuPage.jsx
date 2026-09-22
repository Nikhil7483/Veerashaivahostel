import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  UtensilsCrossed,
  Coffee,
  Sun,
  Moon,
  Clock,
  Building2,
  Calendar,
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-react';

const STATIC_MENU = [
  {
    day: 'Monday',
    order: 1,
    breakfast: 'Pulav (Tomato Bath)',
    lunch: '—',
    dinner: 'Rice / Ragi Mudde + Vegetable Sambar',
    highlight: false
  },
  {
    day: 'Tuesday',
    order: 2,
    breakfast: 'Chitranna (Lemon Rice)',
    lunch: '—',
    dinner: 'Rice / Ragi Mudde + Vegetable Sambar',
    highlight: false
  },
  {
    day: 'Wednesday',
    order: 3,
    breakfast: 'Upma',
    lunch: '—',
    dinner: 'Rice / Chapati + Vegetable Sambar*',
    highlight: false,
    specialNote: 'Chapati option with Sambar'
  },
  {
    day: 'Thursday',
    order: 4,
    breakfast: 'Puliyogare (Tamarind Rice)',
    lunch: '—',
    dinner: 'Rice / Ragi Mudde + Vegetable Sambar',
    highlight: false
  },
  {
    day: 'Friday',
    order: 5,
    breakfast: 'Vangi Bath',
    lunch: '—',
    dinner: 'Rice / Ragi Mudde + Vegetable Sambar',
    highlight: false
  },
  {
    day: 'Saturday',
    order: 6,
    breakfast: 'Avalakki (Poha)',
    lunch: '—',
    dinner: 'Rice / Ragi Mudde + Soppina Sambar (Greens Sambar)',
    highlight: false,
    specialNote: 'Nutritious Greens Sambar'
  },
  {
    day: 'Sunday',
    order: 7,
    breakfast: 'Idli, Chutney, Sambar',
    lunch: 'Anna Sambar (Rice & Sambar)',
    dinner: 'Shavige Payasa (Wheat Payasa) + Rice & Sambar',
    highlight: true,
    specialNote: 'Special Sunday Feast with Sweet Payasa'
  }
];

const WeeklyMessMenuPage = () => {
  const [weeklyMenu, setWeeklyMenu] = useState(STATIC_MENU);
  const [todayDay, setTodayDay] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[new Date().getDay()];
    setTodayDay(currentDay);

    const fetchMenu = async () => {
      try {
        const res = await api.get('/food-allocation/weekly-menu');
        if (res.data && res.data.length > 0) {
          setWeeklyMenu(res.data);
        }
      } catch (err) {
        console.warn('Using static schedule:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, []);

  const todayMenu = weeklyMenu.find((m) => m.day.toLowerCase() === todayDay.toLowerCase()) || weeklyMenu[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Building2 className="w-4 h-4" />
              <span>Veerashaiva Lingayath Boys Hostel • Krushi Nagar, Shivamogga</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Hostel Mess & Dining Weekly Menu
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Official weekly dining schedule and meal timings. Breakfast, Lunch & Dinner.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-blue-600/30 border border-blue-400/30 px-4 py-2 rounded-xl text-blue-200 text-xs font-semibold self-start md:self-auto">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>Today is <strong>{todayDay}</strong></span>
          </div>
        </div>
      </div>

      {/* Timings Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Breakfast */}
        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">Breakfast</div>
            <div className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-4 h-4 text-amber-500" /> 7:00 AM – 8:00 AM
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Served fresh every morning</div>
          </div>
        </div>

        {/* Lunch */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Sun className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Lunch</div>
            <div className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-4 h-4 text-slate-500" /> 1:00 PM – 2:00 PM
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Sundays only (Anna Sambar)</div>
          </div>
        </div>

        {/* Dinner */}
        <div className="bg-white rounded-2xl p-4 border border-indigo-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">Dinner</div>
            <div className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-4 h-4 text-indigo-500" /> 8:00 PM – 9:00 PM
            </div>
            <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
              Service: 8–9 PM • Count: 5:00–6:30 PM
            </div>
          </div>
        </div>
      </div>

      {/* Today's Special Banner */}
      {todayMenu && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> Today's Scheduled Routine ({todayDay})
            </span>
            <span className="text-xs text-blue-100 font-medium">Freshly prepared in hostel mess</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl p-3.5 backdrop-blur-sm border border-white/10">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-200 block mb-1">
                Breakfast (7:00 – 8:00 AM)
              </span>
              <p className="text-base font-extrabold">{todayMenu.breakfast}</p>
            </div>

            <div className="bg-white/10 rounded-xl p-3.5 backdrop-blur-sm border border-white/10">
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200 block mb-1">
                Lunch (1:00 – 2:00 PM)
              </span>
              <p className="text-base font-extrabold">{todayMenu.lunch || '—'}</p>
            </div>

            <div className="bg-white/10 rounded-xl p-3.5 backdrop-blur-sm border border-white/10">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-200 block mb-1">
                Dinner (8:00 – 9:00 PM)
              </span>
              <p className="text-base font-extrabold">{todayMenu.dinner}</p>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Weekly Table (Visible on md and up) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UtensilsCrossed className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-800">Weekly Routine Schedule</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Monday through Sunday Timetable
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wider font-bold border-b border-slate-200">
                <th className="py-3.5 px-5 w-36">Day</th>
                <th className="py-3.5 px-5">Breakfast – 7:00 to 8:00 AM</th>
                <th className="py-3.5 px-5 w-56">Lunch – 1:00 to 2:00 PM</th>
                <th className="py-3.5 px-5">Dinner – 8:00 to 9:00 PM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {weeklyMenu.map((item) => {
                const isToday = item.day.toLowerCase() === todayDay.toLowerCase();
                const isSunday = item.day.toLowerCase() === 'sunday';
                return (
                  <tr
                    key={item.day}
                    className={`transition ${
                      isToday
                        ? 'bg-blue-50/70 font-semibold'
                        : isSunday
                        ? 'bg-amber-50/30'
                        : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-800">{item.day}</span>
                        {isToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                            Today
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-5 font-semibold text-slate-800">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span>{item.breakfast}</span>
                      </div>
                    </td>

                    <td className="py-4 px-5 font-medium text-slate-700">
                      {item.lunch === '—' ? (
                        <span className="text-slate-400 font-mono text-sm">—</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                          {item.lunch}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-5 font-semibold text-slate-800">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <span>{item.dinner}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Day Cards (Visible on screens < 768px) */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <UtensilsCrossed className="w-4 h-4 text-blue-600" />
            7-Day Menu Cards
          </h2>
          <span className="text-[11px] text-slate-500">Tap to review</span>
        </div>

        {weeklyMenu.map((item) => {
          const isToday = item.day.toLowerCase() === todayDay.toLowerCase();
          const isSunday = item.day.toLowerCase() === 'sunday';

          return (
            <div
              key={item.day}
              className={`rounded-2xl p-4 border transition ${
                isToday
                  ? 'bg-blue-50/90 border-blue-300 shadow-md ring-2 ring-blue-500/30'
                  : isSunday
                  ? 'bg-amber-50/50 border-amber-200'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-sm text-slate-900">{item.day}</span>
                  {isToday && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                      Today
                    </span>
                  )}
                </div>
                {item.specialNote && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {item.specialNote}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs">
                {/* Breakfast */}
                <div className="flex items-start space-x-2">
                  <Coffee className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-700 block">
                      Breakfast (7:00 – 8:00 AM)
                    </span>
                    <span className="font-bold text-slate-800">{item.breakfast}</span>
                  </div>
                </div>

                {/* Lunch */}
                <div className="flex items-start space-x-2">
                  <Sun className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">
                      Lunch (1:00 – 2:00 PM)
                    </span>
                    <span className={item.lunch === '—' ? 'text-slate-400 font-mono' : 'font-bold text-emerald-700'}>
                      {item.lunch}
                    </span>
                  </div>
                </div>

                {/* Dinner */}
                <div className="flex items-start space-x-2">
                  <Moon className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-indigo-700 block">
                      Dinner (8:00 – 9:00 PM)
                    </span>
                    <span className="font-bold text-slate-800">{item.dinner}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Special Footnote & Hygiene Notice */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 space-y-1.5">
        <div className="flex items-center space-x-2 font-bold text-slate-800">
          <Info className="w-4 h-4 text-blue-600" />
          <span>Important Dining & Menu Notes</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
          <li>
            <strong>* Wednesday Dinner:</strong> Rice / Chapati + Vegetable Sambar allows residents choice of Chapati or Rice.
          </li>
          <li>
            <strong>Sunday Special Feast:</strong> Idli Sambar for breakfast, Anna Sambar for lunch, and traditional Shavige Payasa (Wheat Payasa) with Rice & Sambar for dinner.
          </li>
          <li>
            <strong>Hygiene & Cleanliness:</strong> The cleaning room student team inspects the mess and verifies student meal counts before every service.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default WeeklyMessMenuPage;
