import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
//import { useTheme } from '../../contexts/ThemeContext';
import './commanderLogsStyles.css';
import { API_BASE_URL } from '../../config';

const API_BASE = API_BASE_URL;

type LogPayload = {
  title?: string | null;
  text_body?: string | null;
  num_deaths?: number | null;
  num_injuries?: number | null;
  estimated_damage_cost?: number | null;
  estimated_resource_cost?: number | null;
  firefighter_required?: number | null;
  medic_required?: number | null;
  police_required?: number | null;
  help_required?: number | null;
  food_required_for_people?: number | null;
};

type Props = {
  open: boolean;
  mode: 'add' | 'update';
  disasterId?: string; // required in add mode
  initial?: Partial<LogPayload> & { log_id?: string };
  onClose: () => void;
  onSuccess?: () => void;
};

const LogModal: React.FC<Props> = ({ open, mode, disasterId, initial, onClose, onSuccess }) => {
  //useTheme();

  // form state
  const [title, setTitle] = useState(initial?.title ?? '');
  //const { theme } = useTheme();
  //const isDark = theme === 'dark';
  const [body, setBody] = useState(initial?.text_body ?? '');
  const [numDeaths, setNumDeaths] = useState(initial?.num_deaths != null ? String(initial.num_deaths) : '');
  const [numInjuries, setNumInjuries] = useState(initial?.num_injuries != null ? String(initial.num_injuries) : '');
  const [estimatedDamageCost, setEstimatedDamageCost] = useState(initial?.estimated_damage_cost != null ? String(initial.estimated_damage_cost) : '');
  const [estimatedResourceCost, setEstimatedResourceCost] = useState(initial?.estimated_resource_cost != null ? String(initial.estimated_resource_cost) : '');
  const [firefighterRequired, setFirefighterRequired] = useState(initial?.firefighter_required != null ? String(initial.firefighter_required) : '');
  const [medicRequired, setMedicRequired] = useState(initial?.medic_required != null ? String(initial.medic_required) : '');
  const [policeRequired, setPoliceRequired] = useState(initial?.police_required != null ? String(initial.police_required) : '');
  const [helpRequired, setHelpRequired] = useState(initial?.help_required != null ? String(initial.help_required) : '');
  const [foodRequiredForPeople, setFoodRequiredForPeople] = useState(initial?.food_required_for_people != null ? String(initial.food_required_for_people) : '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // when initial changes (opening for update), sync into form
    setTitle(initial?.title ?? '');
    setBody(initial?.text_body ?? '');
    setNumDeaths(initial?.num_deaths != null ? String(initial.num_deaths) : '');
    setNumInjuries(initial?.num_injuries != null ? String(initial.num_injuries) : '');
    setEstimatedDamageCost(initial?.estimated_damage_cost != null ? String(initial.estimated_damage_cost) : '');
    setEstimatedResourceCost(initial?.estimated_resource_cost != null ? String(initial.estimated_resource_cost) : '');
    setFirefighterRequired(initial?.firefighter_required != null ? String(initial.firefighter_required) : '');
    setMedicRequired(initial?.medic_required != null ? String(initial.medic_required) : '');
    setPoliceRequired(initial?.police_required != null ? String(initial.police_required) : '');
    setHelpRequired(initial?.help_required != null ? String(initial.help_required) : '');
    setFoodRequiredForPeople(initial?.food_required_for_people != null ? String(initial.food_required_for_people) : '');
  }, [initial]);

  const numOrUndefined = (v: string) => {
    if (v === '' || v == null) return undefined;
    const n = parseFloat(v as any);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleCreate = async () => {
    if (!disasterId) return;
    const payload: any = {
      title: title || undefined,
      text_body: body || undefined,
      num_deaths: numOrUndefined(numDeaths),
      num_injuries: numOrUndefined(numInjuries),
      estimated_damage_cost: numOrUndefined(estimatedDamageCost),
      estimated_resource_cost: numOrUndefined(estimatedResourceCost),
      firefighter_required: numOrUndefined(firefighterRequired),
      medic_required: numOrUndefined(medicRequired),
      police_required: numOrUndefined(policeRequired),
      help_required: numOrUndefined(helpRequired),
      food_required_for_people: numOrUndefined(foodRequiredForPeople),
    };

    try {
      setLoading(true);
      const url = `${API_BASE}/logs/disasters/${encodeURIComponent(disasterId)}`;
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('create failed');
      if (onSuccess) onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    const logId = initial?.log_id;
    if (!logId) return;
    const payload: any = {
      title: title || undefined,
      text_body: body || undefined,
      num_deaths: numOrUndefined(numDeaths),
      num_injuries: numOrUndefined(numInjuries),
      estimated_damage_cost: numOrUndefined(estimatedDamageCost),
      estimated_resource_cost: numOrUndefined(estimatedResourceCost),
      firefighter_required: numOrUndefined(firefighterRequired),
      medic_required: numOrUndefined(medicRequired),
      police_required: numOrUndefined(policeRequired),
      help_required: numOrUndefined(helpRequired),
      food_required_for_people: numOrUndefined(foodRequiredForPeople),
    };

    try {
      setLoading(true);
      const url = `${API_BASE}/logs/${encodeURIComponent(logId)}`;
      const res = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('update failed');
      if (onSuccess) onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const logId = initial?.log_id;
    if (!logId) return;
    try {
      setLoading(true);
      const url = `${API_BASE}/logs/${encodeURIComponent(logId)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('delete failed');
      if (onSuccess) onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="report-modal" role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 60 }}>
      <div className="report-modal__content" style={{ width: 'min(900px, 96%)' }}>
        <header className="report-modal__header">
          <div>
            <p className="title">{mode === 'add' ? 'Add New Log' : 'Update Log'}</p>
            <p className="meta">{mode === 'add' ? 'Create a timeline log entry' : 'Edit this timeline entry'}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>×</button>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
          </label>

          <label>
            Body
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
          </label>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label style={{ flex: 1 }}>
              Deaths
              <input type="number" value={numDeaths} onChange={(e) => setNumDeaths(e.target.value)} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
            </label>
            <label style={{ flex: 1 }}>
              Injuries
              <input type="number" value={numInjuries} onChange={(e) => setNumInjuries(e.target.value)} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label style={{ flex: 1 }}>
              Estimated Damage Cost
              <input type="number" value={estimatedDamageCost} onChange={(e) => setEstimatedDamageCost(e.target.value)} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
            </label>
            <label style={{ flex: 1 }}>
              Estimated Resource Cost
              <input type="number" value={estimatedResourceCost} onChange={(e) => setEstimatedResourceCost(e.target.value)} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 30%' }}>
              Firefighters
              <input type="number" value={firefighterRequired} onChange={(e) => setFirefighterRequired(e.target.value)} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
            </label>
            <label style={{ flex: '1 1 30%' }}>
              Medics
              <input type="number" value={medicRequired} onChange={(e) => setMedicRequired(e.target.value)} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
            </label>
            <label style={{ flex: '1 1 30%' }}>
              Police
              <input type="number" value={policeRequired} onChange={(e) => setPoliceRequired(e.target.value)} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 45%' }}>
              Help Required
              <input type="number" value={helpRequired} onChange={(e) => setHelpRequired(e.target.value)} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
            </label>
            <label style={{ flex: '1 1 45%' }}>
              Food Required (people)
              <input type="number" value={foodRequiredForPeople} onChange={(e) => setFoodRequiredForPeople(e.target.value)} style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }} />
            </label>
          </div>
        </div>

        <div className="report-modal__actions">
          {mode === 'add' ? (
            <button type="button" style={{ marginRight: '0.5rem' }} onClick={() => {
              setTitle(''); setBody(''); setNumDeaths(''); setNumInjuries(''); setEstimatedDamageCost(''); setEstimatedResourceCost(''); setFirefighterRequired(''); setMedicRequired(''); setPoliceRequired(''); setHelpRequired(''); setFoodRequiredForPeople('');
            }}>
              Reset
            </button>
          ) : (
            <button type="button" style={{ marginRight: '0.5rem', backgroundColor: '#f87171', color: '#ffffff', borderRadius: '0.85rem', padding: '0.75rem 1rem' }} onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting…' : 'Delete Log'}
            </button>
          )}

          {mode === 'add' ? (
            <button type="button" className="commander-button emergency" onClick={handleCreate} disabled={loading}>
              {loading ? (mode === 'add' ? 'Adding…' : 'Updating…') : (mode === 'add' ? 'Add' : 'Add')}
            </button>
          ) : (
            <button type="button" className="commander-button emergency" onClick={handleUpdate} disabled={loading}>
              {loading ? 'Updating…' : 'Update Log'}
            </button>
          )}
        </div>
      </div>
    </div>, document.body
  );
};

export default LogModal;
