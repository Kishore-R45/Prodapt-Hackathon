import React, { useState } from 'react';
import { ThreadAnalysis } from '../../shared/types';

interface DraftEditorProps {
  analysis: ThreadAnalysis;
  onSaveDraft: (threadId: string, body: string) => Promise<void>;
}

export const DraftEditor: React.FC<DraftEditorProps> = ({ analysis, onSaveDraft }) => {
  const [body, setBody] = useState<string>(analysis.draft?.body || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const isApprovalRequired = analysis.draft?.requiresApproval ?? false;
  const tone = analysis.draft?.tone || 'formal';

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await onSaveDraft(analysis.threadId, body);
      setSaveStatus('success');
    } catch (err) {
      console.error('Failed to save draft:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Draft Response</h3>
        <span
          style={{
            ...styles.badge,
            backgroundColor: tone === 'casual' ? '#e0f2fe' : '#f3e8ff',
            color: tone === 'casual' ? '#0369a1' : '#6b21a8',
            borderColor: tone === 'casual' ? '#bae6fd' : '#e9d5ff',
          }}
        >
          {tone}
        </span>
      </div>

      {isApprovalRequired && (
        <div style={styles.warningBanner}>
          <span style={{ marginRight: '8px', fontSize: '16px' }}>⚠️</span>
          <div>
            <strong>Approval Required:</strong> Sensitive, legal, or dispute content detected. Please review carefully before saving.
          </div>
        </div>
      )}

      <div style={styles.editorGroup}>
        <textarea
          style={styles.textarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Edit draft response..."
          rows={6}
        />
      </div>

      <div style={styles.footer}>
        <button
          style={{
            ...styles.button,
            opacity: isSaving ? 0.7 : 1,
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving Draft...' : 'Save as Gmail Draft'}
        </button>

        {saveStatus === 'success' && (
          <span style={styles.successText}>Draft saved to Gmail!</span>
        )}
        {saveStatus === 'error' && (
          <span style={styles.errorText}>Failed to save draft. Try again.</span>
        )}

        <p style={styles.safetyNote}>
          ℹ️ Note: This action only saves a draft in Gmail and will never send automatically.
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '12px',
    border: '1px solid',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  warningBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    backgroundColor: '#fffbebf0',
    border: '1px solid #fef08a',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '12px',
    color: '#92400e',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  editorGroup: {
    marginBottom: '12px',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px',
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#1f2937',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    resize: 'vertical',
    outline: 'none',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  button: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
  },
  successText: {
    fontSize: '12px',
    color: '#16a34a',
    fontWeight: 500,
  },
  errorText: {
    fontSize: '12px',
    color: '#dc2626',
    fontWeight: 500,
  },
  safetyNote: {
    margin: 0,
    fontSize: '11px',
    color: '#6b7280',
    lineHeight: '1.3',
  },
};
