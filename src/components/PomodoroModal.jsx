import { useEffect, useState } from 'react';

function PomodoroModal({
  isOpen,
  onClose,
  onSubmit,
  studyMinutes: studyMinutesDefault = 25,
  breakMinutes: breakMinutesDefault = 5,
  submitLabel = 'Accept Quest',
  title = 'Pomodoro Settings',
}) {
  const [studyMinutes, setStudyMinutes] = useState(studyMinutesDefault);
  const [breakMinutes, setBreakMinutes] = useState(breakMinutesDefault);

  useEffect(() => {
    if (!isOpen) return;
    setStudyMinutes(studyMinutesDefault);
    setBreakMinutes(breakMinutesDefault);
  }, [isOpen, studyMinutesDefault, breakMinutesDefault]);

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
          <h2>{title}</h2>
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
              onChange={(e) =>
                setStudyMinutes(parseInt(e.target.value, 10) || studyMinutesDefault)
              }
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
              onChange={(e) =>
                setBreakMinutes(parseInt(e.target.value, 10) || breakMinutesDefault)
              }
              min="1"
              max="60"
              required
            />
          </label>
          <button type="submit" className="btn btn-primary">
            {submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PomodoroModal;
