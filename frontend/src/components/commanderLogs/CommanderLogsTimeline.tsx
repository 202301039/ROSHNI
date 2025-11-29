import type { FC } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FireExtinguisher, Stethoscope, Siren } from 'lucide-react';
import type { FiltersState } from './CommanderLogsSidebar';
import LogModal from './LogModal';
import { API_BASE_URL } from '../../config';

type LogResponse = {
  log_id: string;
  disaster_id: string;
  created_by_user_id?: string | null;
  title?: string | null;
  text_body?: string | null;
  created_at: string;
};

// extended numeric fields from backend
type ExtendedLogResponse = LogResponse & {
  num_deaths?: number | null;
  num_injuries?: number | null;
  estimated_damage_cost?: number | null;
  estimated_resource_cost?: number | null;
  firefighter_required?: number | null;
  medic_required?: number | null;
  police_required?: number | null;
  help_required?: number | null;
  food_required_for_people?: number | null;
  role?: string;
};

const API_BASE = API_BASE_URL;

const CommanderLogsTimeline: FC<{ disasterId?: string; filters?: FiltersState; refreshSignal?: number; onLogCreated?: () => void }> = ({ disasterId, filters, refreshSignal, onLogCreated }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [logs, setLogs] = useState<ExtendedLogResponse[] | null>(null);
  const [editingLog, setEditingLog] = useState<ExtendedLogResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Apply filters to logs
  const applyFilters = (allLogs: ExtendedLogResponse[]): ExtendedLogResponse[] => {
    if (!filters) return allLogs;

    return allLogs.filter((log) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const titleMatch = (log.title || '').toLowerCase().includes(searchLower);
        const idMatch = log.log_id.toLowerCase().includes(searchLower);
        if (!titleMatch && !idMatch) return false;
      }

      // Resource needs filter (only show logs with entries > 0 for checked values)
      const needsKeys = Object.keys(filters.resourceNeeds).filter((k) => filters.resourceNeeds[k]);
      if (needsKeys.length > 0) {
        const matchesAny = needsKeys.some((key) => {
          if (key === 'firefighters' && (log.firefighter_required ?? 0) > 0) return true;
          if (key === 'medics' && (log.medic_required ?? 0) > 0) return true;
          if (key === 'police' && (log.police_required ?? 0) > 0) return true;
          if (key === 'food' && (log.food_required_for_people ?? 0) > 0) return true;
          return false;
        });
        if (!matchesAny) return false;
      }

      // Civilians filters (help_required, num_injuries, num_deaths)
      const civKeys = Object.keys(filters.disasterTypes).filter((k) => filters.disasterTypes[k]);
      if (civKeys.length > 0) {
        const civMatch = civKeys.some((key) => {
          if (key === 'help_required' && (log.help_required ?? 0) > 0) return true;
          if (key === 'num_injuries' && (log.num_injuries ?? 0) > 0) return true;
          if (key === 'num_deaths' && (log.num_deaths ?? 0) > 0) return true;
          return false;
        });
        if (!civMatch) return false;
      }

      // Damage cost range filter
      const damage = log.estimated_damage_cost ?? 0;
      if (damage < filters.damageMin || damage > filters.damageMax) return false;

      // Resource cost range filter
      const resource = log.estimated_resource_cost ?? 0;
      if (resource < filters.resourceMin || resource > filters.resourceMax) return false;

      return true;
    });
  };

  const filteredLogs = logs ? applyFilters(logs) : null;

  // Apply sorting
  const sortedLogs = filteredLogs
    ? [...filteredLogs].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return filters?.sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    })
    : null;

  const items = sortedLogs && sortedLogs.length ? sortedLogs : null;

  useEffect(() => {
    let id = disasterId;
    if (!id) {
      const p = new URLSearchParams(window.location.search).get('disasterId');
      if (p) id = p;
    }
    // If no disaster id provided, fetch all logs endpoint so commanders
    // can view logs across disasters. This is intentionally permissive
    // and can be reverted later.
    const url = id ? `${API_BASE}/logs/disasters/${id}` : `${API_BASE}/logs`;
    let mounted = true;

    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data: ExtendedLogResponse[] = await res.json();
        if (mounted) setLogs(data);
      } catch (e: any) {
        // Error: silently ignore fetch failures
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [disasterId, refreshSignal]);

  const renderTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const time = d.toUTCString().match(/\d{2}:\d{2}/)?.[0] ?? d.toLocaleTimeString();
      const parts = d.toUTCString().split(' ');
      const date = parts.slice(1, 4).join(' ');
      return `${time} UTC, ${date}`;
    } catch { return iso; }
  };



  return (
    <div className={`min-h-screen relative flex-1 flex flex-col overflow-hidden ${isDark ? 'bg-[#0f172a]' : 'bg-slate-50'}`}>
      <main className="grow overflow-y-auto" aria-label="Disaster logs timeline">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className={`relative timeline-container ${items ? '' : 'no-logs'}`}>
            <div className="space-y-12">
              {isLoading ? (
                <div className="py-20 flex items-center justify-center w-full">
                  {/* Blank while loading */}
                </div>
              ) : items ? (
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  {items.map((log, idx) => {
                    const leftTime = idx % 2 === 0;
                    const isExpanded = !!expandedIds[log.log_id];
                    const hasSummaryBadges =
                      (((log as ExtendedLogResponse).estimated_damage_cost ?? null) != null) ||
                      (((log as ExtendedLogResponse).estimated_resource_cost ?? null) != null) ||
                      (((log as ExtendedLogResponse).num_deaths ?? null) != null);
                    return (
                      <div key={log.log_id} className="relative flex items-start mb-12 last:mb-0">
                        <div className={`absolute w-3 h-3 bg-purple-500 rounded-full top-1 left-1/2 -translate-x-1/2 ring-4 ${isDark ? 'ring-[#0f172a]' : 'ring-slate-50'}`} />

                        {leftTime ? (
                          <>
                            <div className="w-1/2 pr-4 text-right">
                              <motion.div
                                initial={{ x: -30, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 + (idx * 0.05), duration: 0.4, ease: "easeOut" }}
                                className="inline-block"
                              >
                                <time className="inline-block bg-purple-500 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-md">
                                  {renderTime(log.created_at)}
                                </time>
                              </motion.div>
                            </div>

                            <div className="w-1/2 pl-4">
                              <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{log.title ?? 'Untitled Log'}</h3>

                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleExpanded(log.log_id)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(log.log_id); } }}
                                className={`p-4 rounded-lg shadow-lg border relative cursor-pointer focus:outline-none ${isDark ? 'bg-[#1e293b] border-gray-700' : 'bg-white border-gray-200'}`}
                              >
                                <div className={`absolute -left-2 top-4 w-4 h-4 transform rotate-45 border-l border-b ${isDark ? 'bg-[#1e293b] border-gray-700' : 'bg-white border-gray-200'}`} />

                                <div>
                                  {hasSummaryBadges ? (
                                    !isExpanded && (
                                      <div className="flex flex-wrap gap-2 text-sm">
                                        {((log as ExtendedLogResponse).estimated_damage_cost ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>
                                            Damages: <span className="font-bold">{rupee.format((log as ExtendedLogResponse).estimated_damage_cost as number)}</span>
                                          </span>
                                        )}
                                        {((log as ExtendedLogResponse).estimated_resource_cost ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>
                                            Resource Cost: <span className="font-bold">{rupee.format((log as ExtendedLogResponse).estimated_resource_cost as number)}</span>
                                          </span>
                                        )}
                                        {((log as ExtendedLogResponse).num_deaths ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-black/40 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                                            Deaths: <span className="font-bold">{(log as ExtendedLogResponse).num_deaths}</span>
                                          </span>
                                        )}
                                      </div>
                                    )
                                  ) : (
                                    <div className={`prose prose-sm max-w-none text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{log.text_body}</div>
                                  )}

                                  {/* Expanded detail area (keeps full badges) */}
                                  <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isExpanded ? 'max-h-[500px]' : 'max-h-0'}`} aria-hidden={!isExpanded}>
                                    <div className={`pt-2 transform transition-all duration-200 ease-in-out ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
                                      <div className="flex flex-wrap gap-2">
                                        {((log as ExtendedLogResponse).firefighter_required ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'}`}><FireExtinguisher className="w-4 h-4" aria-hidden /> Firefighters: <span className="font-bold">{(log as ExtendedLogResponse).firefighter_required}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).medic_required ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-700'}`}><Stethoscope className="w-4 h-4" aria-hidden /> Medics: <span className="font-bold">{(log as ExtendedLogResponse).medic_required}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).police_required ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}><Siren className="w-4 h-4" aria-hidden /> Police: <span className="font-bold">{(log as ExtendedLogResponse).police_required}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).help_required ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-700'}`}>Help Required: <span className="font-bold">{(log as ExtendedLogResponse).help_required ? 'Yes' : 'No'}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).food_required_for_people ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-700'}`}>Food for People: <span className="font-bold">{(log as ExtendedLogResponse).food_required_for_people}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).num_deaths ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-black/40 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>Deaths: <span className="font-bold">{(log as ExtendedLogResponse).num_deaths}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).num_injuries ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-black/40 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>Injuries: <span className="font-bold">{(log as ExtendedLogResponse).num_injuries}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).estimated_damage_cost ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>Damages: <span className="font-bold">{rupee.format((log as ExtendedLogResponse).estimated_damage_cost as number)}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).estimated_resource_cost ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>Resource Cost: <span className="font-bold">{rupee.format((log as ExtendedLogResponse).estimated_resource_cost as number)}</span></span>
                                        )}
                                      </div>

                                      <div className="mt-2 border-t pt-2 space-y-2">
                                        <div className={`prose prose-sm max-w-none text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                          {hasSummaryBadges ? log.text_body : null}
                                        </div>
                                        <div className="text-sm text-gray-400">ID: <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{log.log_id}</span></div>
                                        <div className="text-sm text-gray-400">Created by: <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{log.created_by_user_id ?? 'Unknown'}</span></div>
                                        <div className="text-sm text-gray-400">Created at: <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{renderTime(log.created_at)}</span></div>
                                      </div>
                                      <div className="flex justify-start mt-3">
                                        <button
                                          type="button"
                                          className="commander-button"
                                          title="Edit Log"
                                          onClick={(e) => { e.stopPropagation(); setEditingLog(log); }}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                                          Edit
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                          </>
                        ) : (
                          <>
                            <div className="w-1/2 pr-4 ">
                              <h3 className={`text-lg font-bold text-right mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{log.title ?? 'Untitled Log'}</h3>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleExpanded(log.log_id)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(log.log_id); } }}
                                className={`p-4 rounded-lg shadow-lg border relative cursor-pointer focus:outline-none ${isDark ? 'bg-[#1e293b] border-gray-700' : 'bg-white border-gray-200'}`}
                              >
                                <div className={`absolute -right-2 top-4 w-4 h-4 transform rotate-45 border-r border-t ${isDark ? 'bg-[#1e293b] border-gray-700' : 'bg-white border-gray-200'}`} />

                                <div>
                                  {hasSummaryBadges ? (
                                    !isExpanded && (
                                      <div className="flex flex-wrap gap-2 text-sm">
                                        {((log as ExtendedLogResponse).estimated_damage_cost ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>
                                            Damages: <span className="font-bold">{rupee.format((log as ExtendedLogResponse).estimated_damage_cost as number)}</span>
                                          </span>
                                        )}
                                        {((log as ExtendedLogResponse).estimated_resource_cost ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>
                                            Resource Cost: <span className="font-bold">{rupee.format((log as ExtendedLogResponse).estimated_resource_cost as number)}</span>
                                          </span>
                                        )}
                                        {((log as ExtendedLogResponse).num_deaths ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-black/40 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                                            Deaths: <span className="font-bold">{(log as ExtendedLogResponse).num_deaths}</span>
                                          </span>
                                        )}
                                      </div>
                                    )
                                  ) : (
                                    <div className={`prose prose-sm max-w-none text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{log.text_body}</div>
                                  )}

                                  <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isExpanded ? 'max-h-[500px]' : 'max-h-0'}`} aria-hidden={!isExpanded}>
                                    <div className={`pt-2 transform transition-all duration-200 ease-in-out ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
                                      <div className="flex flex-wrap gap-2">
                                        {((log as ExtendedLogResponse).firefighter_required ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'}`}><FireExtinguisher className="w-4 h-4" aria-hidden /> Firefighters: <span className="font-bold">{(log as ExtendedLogResponse).firefighter_required}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).medic_required ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-700'}`}><Stethoscope className="w-4 h-4" aria-hidden /> Medics: <span className="font-bold">{(log as ExtendedLogResponse).medic_required}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).police_required ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}><Siren className="w-4 h-4" aria-hidden /> Police: <span className="font-bold">{(log as ExtendedLogResponse).police_required}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).help_required ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-700'}`}>Help Required: <span className="font-bold">{(log as ExtendedLogResponse).help_required ? 'Yes' : 'No'}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).food_required_for_people ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-700'}`}>Food for People: <span className="font-bold">{(log as ExtendedLogResponse).food_required_for_people}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).num_deaths ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-black/40 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>Deaths: <span className="font-bold">{(log as ExtendedLogResponse).num_deaths}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).num_injuries ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-black/40 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>Injuries: <span className="font-bold">{(log as ExtendedLogResponse).num_injuries}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).estimated_damage_cost ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>Damages: <span className="font-bold">{rupee.format((log as ExtendedLogResponse).estimated_damage_cost as number)}</span></span>
                                        )}
                                        {((log as ExtendedLogResponse).estimated_resource_cost ?? null) != null && (
                                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${isDark ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>Resource Cost: <span className="font-bold">{rupee.format((log as ExtendedLogResponse).estimated_resource_cost as number)}</span></span>
                                        )}
                                      </div>

                                      <div className="mt-2 border-t pt-2 space-y-2">
                                        <div className={`prose prose-sm max-w-none text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                          {hasSummaryBadges ? log.text_body : null}
                                        </div>
                                        <div className="text-sm text-gray-400">ID: <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{log.log_id}</span></div>
                                        <div className="text-sm text-gray-400">Created by: <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{log.created_by_user_id ?? 'Unknown'}</span></div>
                                        <div className="text-sm text-gray-400">Created at: <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{renderTime(log.created_at)}</span></div>
                                      </div>
                                      <div className="flex justify-start mt-3">
                                        <button
                                          type="button"
                                          className="commander-button"
                                          title="Edit Log"
                                          onClick={(e) => { e.stopPropagation(); setEditingLog(log); }}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                                          Edit
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="w-1/2 pl-4 text-left">
                              <motion.div
                                initial={{ x: 30, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 + (idx * 0.05), duration: 0.4, ease: "easeOut" }}
                                className="inline-block"
                              >
                                <time className="inline-block bg-purple-500 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-md">
                                  {renderTime(log.created_at)}
                                </time>
                              </motion.div>
                            </div>

                          </>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              ) : (
                <div className="py-20 flex items-center justify-center w-full">
                  <div className={`text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <div className="text-xl font-semibold">No logs available</div>
                    <div className="mt-2 text-sm">There are no timeline entries for this disaster.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      {editingLog && (
        <LogModal
          open={true}
          mode="update"
          initial={editingLog}
          onClose={() => setEditingLog(null)}
          onSuccess={() => { setEditingLog(null); if (onLogCreated) try { onLogCreated(); } catch { } }}
        />
      )}
    </div>
  );
};

export default CommanderLogsTimeline;
