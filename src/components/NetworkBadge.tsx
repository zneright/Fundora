import React from 'react';
import { APP_CONFIG } from '../configuration/config';

export const NetworkBadge: React.FC = () => {
  return (
    <div
      className="badge badge-success"
      title={`NEAR ${APP_CONFIG.near.networkId.toUpperCase()} (${APP_CONFIG.near.contractId})`}
    >
      <span className="pulse-beacon" />
      <span>NEAR {APP_CONFIG.near.networkId.toUpperCase()}</span>
    </div>
  );
};
