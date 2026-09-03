import React, { ReactNode } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_KEY } from '../src/config';

export const MapsAppProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <APIProvider apiKey={GOOGLE_MAPS_KEY} version="beta">
    {children}
  </APIProvider>
);
