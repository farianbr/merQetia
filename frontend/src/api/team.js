import api from './axios';

// Team chat channels (org-wide #merQetia + per-department channels)
export const getChannels = () => api.get('/team/channels');

export const getChannelMessages = (id, params) =>
  api.get(`/team/channels/${id}/messages`, { params });

export const getChannelMentionables = (id) =>
  api.get(`/team/channels/${id}/mentionables`);

export const postChannelMessage = (id, text, files = [], mentions = []) => {
  if (files.length === 0) {
    return api.post(`/team/channels/${id}/messages`, { text, mentions });
  }
  const fd = new FormData();
  if (text) fd.append('text', text);
  fd.append('mentions', JSON.stringify(mentions));
  files.forEach((f) => fd.append('files', f));
  return api.post(`/team/channels/${id}/messages`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// Team meetings — invite departments and/or individuals
export const scheduleChannelMeeting = (id, data) =>
  api.post(`/team/channels/${id}/meetings`, data);
export const rescheduleChannelMeeting = (id, messageId, data) =>
  api.patch(`/team/channels/${id}/meetings/${messageId}`, data);
export const cancelChannelMeeting = (id, messageId) =>
  api.delete(`/team/channels/${id}/meetings/${messageId}`);
