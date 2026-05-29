import { LuZoomIn, LuDownload } from 'react-icons/lu';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

const FILE_META = {
  'application/pdf':   { label: 'PDF',  color: '#ef4444' },
  'application/zip':   { label: 'ZIP',  color: '#f59e0b' },
  'application/x-zip-compressed': { label: 'ZIP', color: '#f59e0b' },
  'application/msword': { label: 'DOC', color: '#3b82f6' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'DOCX', color: '#3b82f6' },
  'text/plain': { label: 'TXT', color: '#6b7280' },
};

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatAttachments({ attachments, onImageClick }) {
  if (!attachments?.length) return null;

  return (
    <div className="chat-att-list">
      {attachments.map((att, i) => {
        const src = `${BASE_URL}${att.url}`;

        if (att.mimetype?.startsWith('image/')) {
          return (
            <button
              key={i}
              type="button"
              className="chat-att-img-btn"
              onClick={() => onImageClick?.(src, att.originalName)}
              title={`View ${att.originalName}`}
            >
              <img src={src} alt={att.originalName} className="chat-att-thumb" loading="lazy" />
              <span className="chat-att-img-overlay">
                <LuZoomIn size={18} />
              </span>
            </button>
          );
        }

        const meta = FILE_META[att.mimetype] || { label: 'FILE', color: '#6b7280' };
        return (
          <a
            key={i}
            href={src}
            download={att.originalName}
            target="_blank"
            rel="noreferrer"
            className="chat-att-file-banner"
          >
            <span className="chat-att-file-badge" style={{ background: meta.color }}>
              {meta.label}
            </span>
            <div className="chat-att-file-info">
              <span className="chat-att-file-name">{att.originalName}</span>
              {att.size > 0 && (
                <span className="chat-att-file-size">{fmtSize(att.size)}</span>
              )}
            </div>
            <LuDownload className="chat-att-dl-icon" size={15} />
          </a>
        );
      })}
    </div>
  );
}
