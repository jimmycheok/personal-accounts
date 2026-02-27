import React, { useState, useEffect } from 'react';
import {
  Tile,
  DataTable,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Button,
  Tag,
  InlineLoading,
  InlineNotification,
  FileUploader,
  Select,
  SelectItem,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  TextInput,
} from '@carbon/react';
import { Upload, Download, TrashCan, Folder } from '@carbon/icons-react';
import api from '../../services/api.js';

const DOC_HEADERS = [
  { key: 'name', header: 'File Name' },
  { key: 'category', header: 'Category' },
  { key: 'size', header: 'Size' },
  { key: 'uploaded_at', header: 'Uploaded' },
  { key: 'actions', header: '' },
];

const CATEGORIES = [
  { value: 'all', label: 'All Documents' },
  { value: 'receipt', label: 'Receipts' },
  { value: 'invoice', label: 'Invoice PDFs' },
  { value: 'contract', label: 'Contracts' },
  { value: 'tax', label: 'Tax Documents' },
  { value: 'bank', label: 'Bank Statements' },
  { value: 'other', label: 'Other' },
];

const CAT_COLOR = {
  receipt: 'blue', invoice: 'green', contract: 'purple', tax: 'red', bank: 'cyan', other: 'gray',
};

function formatBytes(bytes) {
  if (!bytes) return '-';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function UploadModal({ open, onClose, onSuccess }) {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (files.length === 0) { setError('Please select files to upload'); return; }
    setUploading(true);
    setError('');
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('subject_type', 'general');
        formData.append('category', category);
        formData.append('description', description);
        await api.post('/documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      onSuccess();
      onClose();
      setFiles([]);
      setDescription('');
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onRequestClose={onClose} modalHeading="Upload Documents"
      primaryButtonText={uploading ? 'Uploading...' : 'Upload'}
      secondaryButtonText="Cancel" onRequestSubmit={handleUpload} primaryButtonDisabled={uploading}>
      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Select id="doc-category" labelText="Document Category" value={category}
          onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.filter(c => c.value !== 'all').map(c => (
            <SelectItem key={c.value} value={c.value} text={c.label} />
          ))}
        </Select>
        <TextInput id="doc-desc" labelText="Description (optional)" value={description}
          onChange={e => setDescription(e.target.value)} placeholder="e.g. TNB Utility Bill March 2025" />
        <FileUploader
          labelTitle="Select Files"
          labelDescription="PDF, images, Word documents accepted"
          buttonLabel="Choose Files"
          filenameStatus="edit"
          accept={['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xlsx', '.csv']}
          multiple
          onChange={e => setFiles(Array.from(e.target.files || []))}
        />
        {files.length > 0 && (
          <p style={{ fontSize: '0.875rem', color: '#525252' }}>
            {files.length} file(s) selected: {files.map(f => f.name).join(', ')}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents', {
        params: { category: categoryFilter !== 'all' ? categoryFilter : undefined },
      });
      setDocuments(res.data.documents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, [categoryFilter]);

  const showNotif = (kind, msg) => {
    setNotification({ kind, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDownload = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.original_name || doc.name;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showNotif('error', 'Download failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try {
      await api.delete(`/documents/${id}`);
      showNotif('success', 'Document deleted');
      fetchDocuments();
    } catch (err) {
      showNotif('error', 'Failed to delete document');
    }
  };

  const filtered = documents.filter(doc =>
    !search || doc.name?.toLowerCase().includes(search.toLowerCase())
    || doc.description?.toLowerCase().includes(search.toLowerCase())
  );

  const rows = filtered.map(doc => ({
    id: String(doc.id),
    name: doc.original_name || doc.name,
    category: doc.category || 'other',
    size: formatBytes(doc.size),
    uploaded_at: doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-MY') : '-',
    _doc: doc,
  }));

  const totalSize = documents.reduce((s, d) => s + (d.size || 0), 0);

  return (
    <div className="page-container">
      {notification && (
        <InlineNotification kind={notification.kind} title={notification.msg} style={{ marginBottom: '1rem' }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Documents</h1>
        <Button renderIcon={Upload} onClick={() => setUploadModalOpen(true)}>Upload Documents</Button>
      </div>

      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <Tile style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f62fe' }}>{documents.length}</div>
          <div style={{ fontSize: '0.875rem', color: '#525252' }}>Total Documents</div>
        </Tile>
        <Tile style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#525252' }}>{formatBytes(totalSize)}</div>
          <div style={{ fontSize: '0.875rem', color: '#525252' }}>Storage Used</div>
        </Tile>
        <Tile style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {CATEGORIES.filter(c => c.value !== 'all').map(cat => {
              const count = documents.filter(d => d.category === cat.value).length;
              return count > 0 ? (
                <Tag key={cat.value} type={CAT_COLOR[cat.value]}>{cat.label}: {count}</Tag>
              ) : null;
            })}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#525252', marginTop: '0.5rem' }}>By Category</div>
        </Tile>
      </div>

      {loading ? <InlineLoading description="Loading documents..." /> : (
        <DataTable rows={rows} headers={DOC_HEADERS} isSortable>
          {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getToolbarProps }) => (
            <TableContainer>
              <TableToolbar {...getToolbarProps()}>
                <TableToolbarContent>
                  <TableToolbarSearch value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." />
                  <Select id="cat-filter" labelText="" value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)} style={{ marginLeft: '1rem', width: 180 }}>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} text={c.label} />)}
                  </Select>
                </TableToolbarContent>
              </TableToolbar>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map(h => <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map(row => {
                    const docData = filtered[tableRows.indexOf(row)];
                    return (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map(cell => (
                          <TableCell key={cell.id}>
                            {cell.info.header === 'category'
                              ? <Tag type={CAT_COLOR[cell.value] || 'gray'}>{cell.value}</Tag>
                              : cell.info.header === 'actions'
                              ? <OverflowMenu flipped size="sm">
                                  <OverflowMenuItem itemText="Download" onClick={() => handleDownload(docData)} />
                                  <OverflowMenuItem itemText="Delete" isDelete onClick={() => handleDelete(row.id)} />
                                </OverflowMenu>
                              : cell.value}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  {tableRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={DOC_HEADERS.length}>
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#525252' }}>
                          <Folder size={48} style={{ marginBottom: '1rem', color: '#8d8d8d' }} />
                          <p>No documents uploaded yet.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}

      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => { fetchDocuments(); showNotif('success', 'Documents uploaded successfully'); }}
      />
    </div>
  );
}
