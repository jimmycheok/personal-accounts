import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  InlineLoading,
  Modal,
  Tag,
} from '@carbon/react';
import { Upload, Download, TrashCan, Attachment, View } from '@carbon/icons-react';
import api from '../services/api.js';
import ConfirmModal from './ConfirmModal.jsx';

const MIME_LABEL = {
  'application/pdf': { label: 'PDF', type: 'red' },
  'image/jpeg': { label: 'JPG', type: 'purple' },
  'image/png': { label: 'PNG', type: 'purple' },
  'image/gif': { label: 'GIF', type: 'purple' },
  'image/webp': { label: 'WEBP', type: 'purple' },
};

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reusable attachment panel.
 * Props:
 *   subjectType — 'invoice' | 'quotation' | 'credit_note'
 *   subjectId   — numeric ID of the parent record
 */
export default function AttachmentsPanel({ subjectType, subjectId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, doc: null });
  const [error, setError] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchAttachments = async () => {
    try {
      const res = await api.get('/documents', {
        params: { subject_type: subjectType, subject_id: subjectId },
      });
      setAttachments(res.data.documents || []);
    } catch {
      setError('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subjectId) fetchAttachments();
  }, [subjectType, subjectId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-uploaded if needed
    e.target.value = '';

    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('subject_type', subjectType);
      form.append('subject_id', String(subjectId));
      await api.post('/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchAttachments();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: doc.mime_type }));
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.original_name || doc.file_name;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Download failed');
    }
  };

  const handlePreview = (doc) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    api.get(`/documents/${doc.id}/preview`, { responseType: 'blob' })
      .then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data], { type: doc.mime_type }));
        setPreviewUrl(url);
      })
      .catch(() => setError('Failed to load preview'))
      .finally(() => setPreviewLoading(false));
  };

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  const handleDelete = (doc) => {
    setConfirmDelete({ open: true, doc });
  };

  const confirmDeleteAttachment = async () => {
    const doc = confirmDelete.doc;
    setConfirmDelete({ open: false, doc: null });
    setDeletingId(doc.id);
    try {
      await api.delete(`/documents/${doc.id}`);
      setAttachments(prev => prev.filter(a => a.id !== doc.id));
    } catch {
      setError('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Attachment size={20} />
          Attachments
          {attachments.length > 0 && (
            <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#525252' }}>({attachments.length})</span>
          )}
        </h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleUpload}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
          />
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={uploading ? undefined : Upload}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !subjectId}
          >
            {uploading ? <InlineLoading description="Uploading..." /> : 'Upload File'}
          </Button>
        </div>
      </div>

      {error && (
        <p style={{ color: '#da1e28', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{error}</p>
      )}

      {loading ? (
        <InlineLoading description="Loading attachments..." />
      ) : attachments.length === 0 ? (
        <p style={{ color: '#6f6f6f', fontSize: '0.875rem', fontStyle: 'italic' }}>No attachments yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {attachments.map(doc => {
            const mimeTag = MIME_LABEL[doc.mime_type] || { label: 'FILE', type: 'gray' };
            return (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.75rem',
                  background: '#f4f4f4',
                  borderRadius: '4px',
                }}
              >
                <Tag type={mimeTag.type} size="sm">{mimeTag.label}</Tag>
                <span style={{ flex: 1, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.original_name || doc.file_name}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6f6f6f', flexShrink: 0 }}>
                  {formatBytes(doc.file_size)}
                </span>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={View}
                  iconDescription="Preview"
                  hasIconOnly
                  onClick={() => handlePreview(doc)}
                  tooltipPosition="left"
                />
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Download}
                  iconDescription="Download"
                  hasIconOnly
                  onClick={() => handleDownload(doc)}
                  tooltipPosition="left"
                />
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={TrashCan}
                  iconDescription="Delete"
                  hasIconOnly
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                  tooltipPosition="left"
                />
              </div>
            );
          })}
        </div>
      )}

      {createPortal(
        <Modal
          open={!!previewDoc}
          onRequestClose={closePreview}
          modalHeading={previewDoc?.original_name || previewDoc?.file_name || 'Preview'}
          passiveModal
          size="lg"
          style={{ zIndex: 9100 }}
        >
          <div style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {previewLoading && <InlineLoading description="Loading preview..." />}
            {previewUrl && previewDoc?.mime_type === 'application/pdf' && (
              <iframe
                src={previewUrl}
                title="PDF Preview"
                style={{ width: '100%', height: '60vh', border: 'none' }}
              />
            )}
            {previewUrl && previewDoc?.mime_type?.startsWith('image/') && (
              <img
                src={previewUrl}
                alt={previewDoc?.original_name || 'Preview'}
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
              />
            )}
          </div>
        </Modal>,
        document.body
      )}

      <ConfirmModal
        open={confirmDelete.open}
        title="Delete Attachment"
        message={`Delete "${confirmDelete.doc?.original_name || confirmDelete.doc?.file_name || 'file'}"?`}
        confirmText="Delete"
        onConfirm={confirmDeleteAttachment}
        onCancel={() => setConfirmDelete({ open: false, doc: null })}
      />
    </div>
  );
}
