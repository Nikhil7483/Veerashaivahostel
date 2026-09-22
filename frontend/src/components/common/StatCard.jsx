import React from 'react';

const StatCard = ({ title, value, icon: Icon, color = 'blue', subtitle, onClick, badge }) => {
  const iconBgMap = {
    blue: 'bg-blue-600 text-white',
    indigo: 'bg-indigo-600 text-white',
    emerald: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    rose: 'bg-rose-600 text-white',
    purple: 'bg-purple-600 text-white',
    slate: 'bg-slate-700 text-white',
  };

  return (
    <div
      onClick={onClick}
      className={`relative p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs transition-all duration-200 hover:shadow-md ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{title}</p>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            {badge && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl shadow-xs ${iconBgMap[color] || 'bg-blue-600 text-white'}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
