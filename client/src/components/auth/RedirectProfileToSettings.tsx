import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants';


/**
 * Consolidation: legacy /profile route now redirects to
 * /settings?tab=profile.
 */
const RedirectProfileToSettings = () => {
  return <Navigate to={`${ROUTES.SETTINGS}?tab=profile`} replace />;
};

export default RedirectProfileToSettings;

