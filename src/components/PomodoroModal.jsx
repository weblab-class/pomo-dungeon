import { useState } from 'react';

function PomodoroModal({ isOpen, onClose, onSubmit }) {
  const [studyMinutes, setStudyMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      studyMinutes,
      breakMinutes,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal add-task-modal">
        <div className="modal-header">
          <h2>Pomodoro Settings</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="form-group">
            <span>Study (minutes)</span>
            <input
              type="number"
              value={studyMinutes}
              onChange={(e) => setStudyMinutes(parseInt(e.target.value, 10) || 25)}
              min="1"
              max="180"
              required
            />
          </label>
          <label className="form-group">
            <span>Break (minutes)</span>
            <input
              type="number"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(parseInt(e.target.value, 10) || 5)}
              min="1"
              max="60"
              required
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Accept Quest
          </button>
        </form>
      </div>
    </div>
  );
}

export default PomodoroModal;
