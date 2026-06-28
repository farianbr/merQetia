import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MentionInput from './MentionInput';
import ChatAttachments from './ChatAttachments';
import MeetingMessage from './MeetingMessage';
import ImageLightbox from './ImageLightbox';
import TeamMeetingModal from './TeamMeetingModal';
import { extractMentionIds, highlightMentions } from '../utils/mentions';
import { useNow } from '../utils/meeting';
import {
  getChannelMessages, getChannelMentionables, postChannelMessage,
  scheduleChannelMeeting, rescheduleChannelMeeting, cancelChannelMeeting,
} from '../api/team';
import { LuHash, LuUsers, LuSend, LuPaperclip, LuVideo, LuFile, LuX, LuMessageSquare } from 'react-icons/lu';

function initialsOf(name) {
  return (name || '—').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtTimeAgo(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * A team channel chat surface (reused by the admin & employee team pages).
 * Loads a channel's history, streams new messages/meetings over the socket,
 * supports @mentions, file attachments, and scheduling video meetings.
 */
export default function ChannelChat({ channel }) {
  const { user } = useAuth();
  const socket = useSocket();
  const now = useNow();
  const myId = String(user?._id || user?.id || '');

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [text, setText] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [meetingModal, setMeetingModal] = useState(null); // { mode:'new' } | { mode:'reschedule', message }
  const [cancelling, setCancelling] = useState(null);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const channelId = channel?._id;

  // Merge a message into the list (dedupe by id; replace on update).
  const upsertMessage = useCallback((msg) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m._id === msg._id);
      if (idx === -1) return [...prev, msg];
      const next = [...prev];
      next[idx] = msg;
      return next;
    });
  }, []);

  // Load history + mentionables when the channel changes.
  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    Promise.all([getChannelMessages(channelId), getChannelMentionables(channelId)])
      .then(([msgRes, mentRes]) => {
        if (cancelled) return;
        setMessages(msgRes.data.messages || []);
        setHasMore(!!msgRes.data.hasMore);
        setParticipants(mentRes.data.participants || []);
      })
      .catch(() => { if (!cancelled) { setMessages([]); setParticipants([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channelId]);

  // Live updates for this channel.
  useEffect(() => {
    if (!socket || !channelId) return;
    const onMessage = (payload) => {
      if (payload.channelId === String(channelId)) upsertMessage(payload.message);
    };
    socket.on('team:message', onMessage);
    socket.on('team:message:update', onMessage);
    return () => {
      socket.off('team:message', onMessage);
      socket.off('team:message:update', onMessage);
    };
  }, [socket, channelId, upsertMessage]);

  // Scroll to newest on channel switch / new message — but NOT when prepending
  // older history (the newest id is unchanged then).
  const lastMessageId = messages[messages.length - 1]?._id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastMessageId, channelId]);

  const loadEarlier = async () => {
    if (!messages.length) return;
    try {
      const r = await getChannelMessages(channelId, { before: messages[0].createdAt });
      const older = r.data.messages || [];
      setHasMore(!!r.data.hasMore);
      setMessages((prev) => [...older, ...prev]);
    } catch { /* ignore */ }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() && attachFiles.length === 0) return;
    setSending(true);
    try {
      const mentions = extractMentionIds(text, participants);
      const r = await postChannelMessage(channelId, text.trim(), attachFiles, mentions);
      setText('');
      setAttachFiles([]);
      upsertMessage(r.data.message);
    } catch { /* silent */ } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files);
    setAttachFiles((prev) => [...prev, ...picked].slice(0, 5));
    e.target.value = '';
  };

  const submitMeeting = async (body) => {
    const mode = meetingModal?.mode;
    const r = mode === 'reschedule'
      ? await rescheduleChannelMeeting(channelId, meetingModal.message._id, body)
      : await scheduleChannelMeeting(channelId, body);
    upsertMessage(r.data.message);
    return r.data.message;
  };

  const handleCancelMeeting = async (msg) => {
    if (!window.confirm('Cancel this meeting? Attendees will be notified.')) return;
    setCancelling(msg._id);
    try {
      const r = await cancelChannelMeeting(channelId, msg._id);
      upsertMessage(r.data.message);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel the meeting.');
    } finally {
      setCancelling(null);
    }
  };

  const canManageMeeting = (msg) => user?.role === 'admin' || String(msg.sender?._id) === myId;

  return (
    <div className="tc-chat">
      {/* Header */}
      <div className="tc-head">
        <span className="tc-head-name">
          {channel.kind === 'org' ? <LuHash size={16} /> : <LuUsers size={16} />}
          {channel.name}
        </span>
        <div className="tc-head-right">
          {channel.memberCount != null && (
            <span className="tc-head-count"><LuUsers size={13} /> {channel.memberCount}</span>
          )}
          <button className="btn-secondary btn-sm" onClick={() => setMeetingModal({ mode: 'new' })}>
            <LuVideo size={14} /> Schedule meeting
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="tc-messages">
        {loading ? (
          <div className="mq-panel-placeholder"><p>Loading…</p></div>
        ) : messages.length === 0 ? (
          <div className="mq-panel-placeholder">
            <LuMessageSquare size={32} color="#d1d5db" />
            <p>No messages yet. Say hello to the team.</p>
          </div>
        ) : (
          <div className="mq-panel-chat">
            {hasMore && (
              <button className="tc-load-earlier" onClick={loadEarlier}>Load earlier messages</button>
            )}
            {messages.map((msg) => {
              if (msg.kind === 'meeting') {
                return (
                  <MeetingMessage
                    key={msg._id}
                    meeting={msg.meeting}
                    now={now}
                    canManage={canManageMeeting(msg)}
                    showCalendarLink
                    onReschedule={() => setMeetingModal({ mode: 'reschedule', message: msg })}
                    onCancel={() => handleCancelMeeting(msg)}
                    cancelling={cancelling === msg._id}
                  />
                );
              }
              const senderName = msg.sender?.name || '—';
              return (
                <div key={msg._id} className="mq-msg">
                  <span className="mq-msg-avatar" style={{ background: msg.senderRole === 'admin' ? '#7c4dff' : '#1f8cb4' }}>
                    {initialsOf(senderName)}
                  </span>
                  <div className="mq-msg-main">
                    <div className="mq-msg-meta">
                      <span className="mq-msg-sender">{senderName} <span className="tc-role">{msg.senderRole}</span></span>
                      <span className="mq-msg-time">{fmtTimeAgo(msg.createdAt)}</span>
                    </div>
                    {msg.text && <p className="mq-msg-text">{highlightMentions(msg.text, msg.mentions)}</p>}
                    <ChatAttachments attachments={msg.attachments} onImageClick={(src, name) => setLightbox({ src, name })} />
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <form className="tc-input" onSubmit={handleSend}>
        {attachFiles.length > 0 && (
          <div className="chat-attach-preview">
            {attachFiles.map((f, i) => (
              <div key={i} className="chat-attach-chip">
                {f.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(f)} alt={f.name} className="chat-attach-thumb" />
                ) : (
                  <LuFile size={14} />
                )}
                <span className="chat-attach-chip-name">{f.name}</span>
                <button type="button" onClick={() => setAttachFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove">
                  <LuX size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="tc-input-row">
          <button type="button" className="tc-attach-btn" onClick={() => fileInputRef.current?.click()} aria-label="Attach files" disabled={sending}>
            <LuPaperclip size={17} />
          </button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange}
            accept="image/*,.pdf,.zip,.doc,.docx,.txt" />
          <MentionInput
            value={text}
            onChange={setText}
            participants={participants}
            disabled={sending}
            placeholder={`Message ${channel.name}…  use @ to mention`}
            className="input tc-text"
          />
          <button type="submit" className="btn-primary btn-sm" disabled={sending || (!text.trim() && attachFiles.length === 0)}>
            <LuSend size={14} />
          </button>
        </div>
      </form>

      {meetingModal && (
        <TeamMeetingModal
          existing={meetingModal.mode === 'reschedule' ? meetingModal.message : null}
          mentionables={participants}
          onSubmit={submitMeeting}
          onClose={() => setMeetingModal(null)}
        />
      )}
      {lightbox && <ImageLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />}
    </div>
  );
}
