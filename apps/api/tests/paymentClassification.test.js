import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPayment } from '../services/paymentClassification.js';

test('classifyPayment: no matched entry and no orphan is missing (safe to repair)', () => {
  const result = classifyPayment({ invoiceNumber: 'INV-0007', matchedEntry: null, orphanEntries: [] });
  assert.equal(result.status, 'missing');
});

test('classifyPayment: matched entry naming its own invoice is covered', () => {
  const result = classifyPayment({
    invoiceNumber: 'INV-0001',
    matchedEntry: { id: 9, description: 'Payment received for INV-0001' },
    orphanEntries: [],
  });
  assert.equal(result.status, 'covered');
});

test('classifyPayment: matched entry naming a DIFFERENT invoice is ambiguous (source_id collision)', () => {
  // Reproduces the live dev-DB case: payment 4 (invoice INV-0002) collides
  // on source_id with invoice 4's markPaid entry (JE 17, "...INV-0004").
  const result = classifyPayment({
    invoiceNumber: 'INV-0002',
    matchedEntry: { id: 17, description: 'Payment received for INV-0004' },
    orphanEntries: [],
  });
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.entryId, 17);
  assert.match(result.reason, /source_id collision/);
});

test('classifyPayment: a source_id IS NULL orphan naming this invoice is ambiguous, even with no source_id match', () => {
  // This is the Fix 7 scenario: a pre-Task-3 markPaid entry has
  // source_id = NULL, so it never matches on source_id at all — without the
  // orphan cross-check this would look simply "missing" and get repaired,
  // double-counting the inflow.
  const result = classifyPayment({
    invoiceNumber: 'INV-0002',
    matchedEntry: null,
    orphanEntries: [{ id: 11, description: 'Payment received for INV-0002' }],
  });
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.entryId, 11);
  assert.match(result.reason, /orphan/);
});

test('classifyPayment: orphan check wins even when a source_id match also exists', () => {
  // Live dev-DB case for payment id=4: it has BOTH a source_id collision
  // (JE 17, invoice 4's markPaid) AND a covering orphan (JE 11, invoice 2's
  // pre-Task-3 markPaid). The orphan reason must be reported, not the
  // source_id collision — the orphan is the reason repair is unsafe.
  const result = classifyPayment({
    invoiceNumber: 'INV-0002',
    matchedEntry: { id: 17, description: 'Payment received for INV-0004' },
    orphanEntries: [{ id: 11, description: 'Payment received for INV-0002' }],
  });
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.entryId, 11);
  assert.match(result.reason, /orphan/);
});

test('classifyPayment: no invoice number (orphaned payment row) never matches an orphan by accident', () => {
  const result = classifyPayment({
    invoiceNumber: null,
    matchedEntry: null,
    orphanEntries: [{ id: 11, description: 'Payment received for INV-0002' }],
  });
  assert.equal(result.status, 'missing');
});

test('classifyPayment: invoice void is skipped, not missing, even with no matched entry', () => {
  // Fix B: voiding an invoice deliberately deletes its payment-sourced
  // entries, leaving the payments row intact. Without the void check this
  // would look exactly like a genuinely missing entry and get auto-repaired
  // by --apply, recreating the phantom inflow the void removed.
  const result = classifyPayment({
    invoiceNumber: 'INV-0002',
    invoiceStatus: 'void',
    matchedEntry: null,
    orphanEntries: [],
  });
  assert.equal(result.status, 'void_skip');
});

test('classifyPayment: invoice void wins even when a matched entry still exists', () => {
  const result = classifyPayment({
    invoiceNumber: 'INV-0002',
    invoiceStatus: 'void',
    matchedEntry: { id: 5, description: 'Payment received for INV-0002' },
    orphanEntries: [],
  });
  assert.equal(result.status, 'void_skip');
});

test('classifyPayment: invoice void wins over an ambiguous source_id collision', () => {
  const result = classifyPayment({
    invoiceNumber: 'INV-0002',
    invoiceStatus: 'void',
    matchedEntry: { id: 17, description: 'Payment received for INV-0004' },
    orphanEntries: [],
  });
  assert.equal(result.status, 'void_skip');
});

test('classifyPayment: non-void invoice status is unaffected (still classifies normally)', () => {
  const result = classifyPayment({
    invoiceNumber: 'INV-0001',
    invoiceStatus: 'paid',
    matchedEntry: { id: 9, description: 'Payment received for INV-0001' },
    orphanEntries: [],
  });
  assert.equal(result.status, 'covered');
});

test('classifyPayment: multiple orphans — matches the one naming this invoice', () => {
  const result = classifyPayment({
    invoiceNumber: 'INV-0002',
    matchedEntry: null,
    orphanEntries: [
      { id: 5, description: 'Payment received for INV-0001' },
      { id: 11, description: 'Payment received for INV-0002' },
    ],
  });
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.entryId, 11);
});
