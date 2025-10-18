import { useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

export const LegacyRedirect = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only redirect if we're on the homepage with query params
    if (location.pathname !== '/') return;

    const brand = searchParams.get('brand');
    const model = searchParams.get('model');
    const resins = searchParams.get('resins');

    if (brand && model) {
      // Build new path with preserved resins param if exists
      const newPath = `/${brand}/${model}${resins ? `?resins=${resins}` : ''}`;
      navigate(newPath, { replace: true });
    } else if (brand) {
      const newPath = `/${brand}`;
      navigate(newPath, { replace: true });
    }
  }, [searchParams, navigate, location.pathname]);

  return null;
};
