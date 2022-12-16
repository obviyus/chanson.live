import { RemixBrowser } from '@remix-run/react';
// eslint-disable-next-line n/file-extension-in-import
import { hydrateRoot } from 'react-dom/client';

hydrateRoot(document, <RemixBrowser />);
