import { useEffect, useState } from 'react';

const STORAGE_KEY = 'idfg-hunt-plan-v1';
const CHANGE_EVENT = 'idfg-hunt-plan-change';
const validIds = new Set(['82313', '78813']);

const readPlan = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id) => validIds.has(id)) : [];
  } catch {
    return [];
  }
};

export function useHuntPlan() {
  const [huntIds, setHuntIds] = useState(readPlan);

  useEffect(() => {
    const sync = () => setHuntIds(readPlan());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = (next) => {
    const unique = [...new Set(next)].filter((id) => validIds.has(id));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
    setHuntIds(unique);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const toggle = (huntId) => update(huntIds.includes(huntId)
    ? huntIds.filter((id) => id !== huntId)
    : [...huntIds, huntId]);

  return {
    huntIds,
    isSaved: (huntId) => huntIds.includes(huntId),
    toggle,
    addAll: () => update([...validIds]),
  };
}
