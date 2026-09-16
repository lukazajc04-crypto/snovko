import { forwardRef } from 'react';

const NoteCard = forwardRef(function NoteCard({ children, tilt = -1, className = '', as: Tag = 'section' }, ref) {
  return (
    <Tag ref={ref} className={`note-card ${className}`} style={{ '--tilt': `${tilt}deg` }}>
      <span className="washi" aria-hidden="true" />
      {children}
    </Tag>
  );
});

export default NoteCard;
