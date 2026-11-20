import { Link } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';

interface AdministrasiPlaceholderPageProps {
  name: string;
}

export function AdministrasiPlaceholderPage({
  name,
}: AdministrasiPlaceholderPageProps) {
  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-5">
        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
          <Clock className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-display text-xl font-bold text-slate-900 tracking-tight">
            {name}
          </h1>
          <p className="text-sm text-slate-600">
            Fitur {name} akan segera hadir
          </p>
        </div>
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Kembali ke Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
