import { useState } from 'react';
import { Agenda } from '../components/Agenda';
export function Calendar({ today, onMail }: { today: string; onMail: () => void }) {
  const [day, setDay] = useState(today);
  const [all, setAll] = useState(false);
  return (
    <>
      <div className="filter-bar calendar-filter">
        <label>
          Fecha de agenda{' '}
          <input
            aria-label="Fecha de agenda"
            type="date"
            value={day}
            onChange={(event) => {
              if (event.target.value) {
                setDay(event.target.value);
                setAll(false);
              }
            }}
          />
        </label>
        <button
          className="secondary"
          onClick={() => {
            setDay(today);
            setAll(false);
          }}
        >
          Hoy
        </button>
        <button className="secondary" aria-pressed={all} onClick={() => setAll(!all)}>
          Ver período descargado
        </button>
      </div>
      <Agenda key={all ? 'all' : day} day={all ? undefined : day} onMail={onMail} />
    </>
  );
}
