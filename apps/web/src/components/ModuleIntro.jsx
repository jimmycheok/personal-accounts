import React from 'react';

/** One-line plain-language explainer shown under a page title. */
export default function ModuleIntro({ children }) {
  return (
    <p style={{
      margin: '0.25rem 0 0',
      maxWidth: '60ch',
      fontSize: '0.875rem',
      lineHeight: 1.4,
      color: 'var(--cds-text-secondary, #525252)',
    }}>
      {children}
    </p>
  );
}
