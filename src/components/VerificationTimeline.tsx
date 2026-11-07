/**
 * Fundora — 13-Stage Visual KYC Verification Timeline, 6-Metric Scorecard,
 * and Interactive AI Typo Correction Cards (Preserved & Hardened per FD-SDLC-08).
 */

import React from 'react';
import { CheckCircle2, Clock, Sparkles, ShieldAlert } from 'lucide-react';
import { VERIFICATION_13_STAGES } from '../services/verification.service';
import type { TypoCorrectionSuggestion, VerificationScoreCard } from '../types';

interface VerificationTimelineProps {
  currentStageIndex: number;
  scoreCard?: VerificationScoreCard | null;
  onAcceptTypoSuggestion?: (suggestion: TypoCorrectionSuggestion) => void;
}

export const VerificationTimeline: React.FC<VerificationTimelineProps> = ({
  currentStageIndex,
  scoreCard,
  onAcceptTypoSuggestion,
}) => {
  const metrics = scoreCard
    ? [
        { label: 'Legal Name Match', value: scoreCard.nameMatchScore },
        { label: 'PSGC Jurisdiction Match', value: scoreCard.jurisdictionMatchScore },
        { label: 'ID Document Authenticity', value: scoreCard.documentAuthenticityScore },
        { label: 'Residency Consistency', value: scoreCard.residencyConsistencyScore },
        { label: 'R.A. 10742 Age Compliance', value: scoreCard.ageComplianceScore },
        { label: 'Biometric Selfie Liveness', value: scoreCard.livenessScore },
      ]
    : [];

  return (
    <div className="bank-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <div className="bank-card-header" style={{ marginBottom: 0 }}>
        <div>
          <h4 className="bank-card-title" style={{ fontSize: '1rem' }}>
            13-Stage Civic KYC & Jurisdiction Audit
          </h4>
          <p className="bank-card-subtitle">
            Automated SHA-256 duplicate check, OCR cross-verification & R.A. 10742 compliance
          </p>
        </div>
        {scoreCard && (
          <span
            className={`badge ${
              scoreCard.verdict === 'PASS'
                ? 'badge-success'
                : scoreCard.verdict === 'REVIEW_REQUIRED'
                  ? 'badge-warning'
                  : 'badge-danger'
            }`}
          >
            {scoreCard.overallScore}% • {scoreCard.verdict}
          </span>
        )}
      </div>

      {/* 13-Stage Progress List */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.45rem',
        }}
      >
        {VERIFICATION_13_STAGES.map((stageLabel, idx) => {
          const isDone = idx <= currentStageIndex;
          return (
            <div
              key={stageLabel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.65rem',
                borderRadius: 10,
                background: isDone ? 'var(--role-accent-soft)' : 'var(--bg-elevated)',
                border: `1px solid ${isDone ? 'var(--role-accent-border)' : 'var(--border-subtle)'}`,
                fontSize: '0.76rem',
                fontWeight: isDone ? 700 : 500,
                color: isDone ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {isDone ? (
                <CheckCircle2 size={14} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
              ) : (
                <Clock size={14} style={{ flexShrink: 0 }} />
              )}
              <span>{stageLabel}</span>
            </div>
          );
        })}
      </div>

      {/* 6-Metric Bars */}
      {scoreCard && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {metrics.map((m) => (
            <div key={m.label} className="stat-tile" style={{ padding: '0.65rem 0.85rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                }}
              >
                <span>{m.label}</span>
                <span style={{ color: 'var(--role-badge-color)' }}>{m.value}%</span>
              </div>
              <div className="quorum-progress-track" style={{ marginTop: '0.35rem' }}>
                <div className="quorum-progress-fill" style={{ width: `${m.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Flags */}
      {scoreCard && scoreCard.flags.length > 0 && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 12,
            background: 'var(--accent-danger-soft)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          {scoreCard.flags.map((flag) => (
            <div
              key={flag}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#f87171',
              }}
            >
              <ShieldAlert size={15} />
              <span>{flag}</span>
            </div>
          ))}
        </div>
      )}

      {/* Interactive AI Typo Suggestions */}
      {scoreCard?.typoSuggestions && scoreCard.typoSuggestions.length > 0 && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: 14,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--role-accent-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              color: 'var(--role-badge-color)',
            }}
          >
            <Sparkles size={16} />
            <span>AI OCR Typo Reconciliation Suggestion</span>
          </div>
          {scoreCard.typoSuggestions.map((sug) => (
            <div
              key={`${sug.field}_${sug.extractedValue}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexWrap: 'wrap',
                fontSize: '0.82rem',
              }}
            >
              <span>
                Field <strong>{sug.field}</strong>: entered{' '}
                <code>{sug.submittedValue}</code> vs ID OCR{' '}
                <code>{sug.extractedValue}</code> ({Math.round(sug.confidence * 100)}% match)
              </span>
              {onAcceptTypoSuggestion && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onAcceptTypoSuggestion(sug)}
                >
                  Apply "{sug.extractedValue}"
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
