import { useState, useMemo, useRef } from 'react';
import { PRIORITY } from '../data/constants';

// Format a Date for datetime-local input (YYYY-MM-DDTHH:mm in local time)
const toDatetimeLocal = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const PRESETS = [
  { id: 'none', label: 'No deadline' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: '3days', label: 'In 3 days' },
  { id: 'week', label: 'In 1 week' },
];

function getPresetDatetime(id) {
  const d = new Date();
  d.setSeconds(0, 0);
  if (id === 'none') return '';
  if (id === 'today') {
    d.setHours(23, 59, 0, 0);
    return toDatetimeLocal(d);
  }
  if (id === 'tomorrow') {
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 0, 0);
    return toDatetimeLocal(d);
  }
  if (id === '3days') {
    d.setDate(d.getDate() + 3);
    d.setHours(23, 59, 0, 0);
    return toDatetimeLocal(d);
  }
  if (id === 'week') {
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    return toDatetimeLocal(d);
  }
  return '';
}

function AddTaskModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [timeEstimate, setTimeEstimate] = useState(25);
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState(PRIORITY.MEDIUM);
  const datetimeInputRef = useRef(null);

  // Min for datetime-local: now (so users can't pick a past time)
  const minDatetime = useMemo(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return toDatetimeLocal(d);
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      timeEstimate,
      deadline: deadline || null,
      priority,
    });

    // Reset form
    setName('');
    setTimeEstimate(25);
    setDeadline('');
    setPriority(PRIORITY.MEDIUM);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal add-task-modal">
        <div className="modal-header">
          <h2>New Quest</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="form-group">
            <span>Quest Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </label>
          <label className="form-group">
            <span>Time Estimate (minutes)</span>
            <input
              type="number"
              value={timeEstimate}
              onChange={(e) => setTimeEstimate(parseInt(e.target.value) || 25)}
              min="1"
              max="480"
              required
            />
          </label>
          <div className="form-group">
            <span>Deadline (optional)</span>
            <p className="form-hint">When does this quest need to be completed?</p>
            <div className="deadline-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`deadline-preset-btn ${(p.id === 'none' && !deadline) || (p.id !== 'none' && deadline === getPresetDatetime(p.id)) ? 'active' : ''}`}
                  onClick={() => setDeadline(getPresetDatetime(p.id))}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="deadline-datetime-label">
              <span className="deadline-datetime-label-text">Or pick date & time</span>
              <div className="deadline-datetime-wrap">
                <input
                  ref={datetimeInputRef}
                  type="datetime-local"
                  className="deadline-datetime-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  min={minDatetime}
                  aria-label="Deadline date and time"
                />
                <span
                  className="deadline-datetime-icon"
                  aria-hidden="true"
                  onClick={() => {
                    if (typeof datetimeInputRef.current?.showPicker === 'function') {
                      datetimeInputRef.current.showPicker();
                    } else {
                      datetimeInputRef.current?.focus();
                    }
                  }}
                />
              </div>
            </label>
          </div>
          <label className="form-group">
            <span>Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value={PRIORITY.LOW}>Low</option>
              <option value={PRIORITY.MEDIUM}>Medium</option>
              <option value={PRIORITY.HIGH}>High</option>
              <option value={PRIORITY.URGENT}>URGENT</option>
            </select>
          </label>
          <button type="submit" className="btn btn-primary">
            Create Quest
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddTaskModal;
