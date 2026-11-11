import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPage } from '../services/analyticsClient';

/** Counts page views for Haven's anonymous audience measurement (kind of page only). */
export function AnalyticsTracker() {
  const { pathname } = useLocation();
  useEffect(() => { trackPage(pathname); }, [pathname]);
  return null;
}
