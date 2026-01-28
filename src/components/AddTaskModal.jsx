import { useState } from 'react';
import { PRIORITY } from '../data/constants';

function AddTaskModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [timeEstimate, setTimeEstimate] = useState(25);
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState(PRIORITY.MEDIUM);

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
          <label className="form-group">
            <span>Deadline</span>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
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
