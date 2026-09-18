import { useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { UrlStateProvider, type UrlState } from './url-state';

/** Standalone implementation on top of react-router. */
export function RouterUrlProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const search = searchParams.toString();

  const value = useMemo<UrlState>(
    () => ({ search, navigate: (next, { replace }) => navigate({ pathname, search: next }, { replace }) }),
    [search, navigate, pathname],
  );
  return <UrlStateProvider value={value}>{children}</UrlStateProvider>;
}
