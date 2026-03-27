import React from 'react';
import { Modal } from '@carbon/react';

export default function ConfirmModal({ open, title, message, danger = true, confirmText = 'Confirm', onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      danger={danger}
      modalHeading={title || 'Confirm'}
      primaryButtonText={confirmText}
      secondaryButtonText="Cancel"
      onRequestSubmit={onConfirm}
      onRequestClose={onCancel}
      size="xs"
    >
      <p style={{ fontSize: '0.875rem', color: '#525252' }}>{message}</p>
    </Modal>
  );
}
