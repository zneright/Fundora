import React from 'react';
import { FileCheck2 } from 'lucide-react';
import type { UploadedDocumentItem } from '../../types';

interface IdentityUploadViewProps {
  documents: UploadedDocumentItem[];
}

export const IdentityUploadView: React.FC<IdentityUploadViewProps> = ({ documents }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="doc-inspect-card"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileCheck2 size={16} style={{ color: 'var(--accent-green)' }} />
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{doc.tag}</div>
              <div className="text-muted-sm">{doc.label}</div>
            </div>
          </div>
          <code style={{ fontSize: '0.72rem' }}>{doc.sha256Hash.slice(0, 12)}...</code>
        </div>
      ))}
    </div>
  );
};
