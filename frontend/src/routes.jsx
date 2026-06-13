import { createBrowserRouter } from 'react-router'

import { Root } from './components/Root.jsx'
import { AuthorityMapPage } from './pages/AuthorityMapPage.jsx'
import { NavigationDemoPage } from './pages/NavigationDemoPage.jsx'
import { NavigationPage } from './pages/NavigationPage.jsx'
import { SettingsPage } from './pages/SettingsPage.jsx'
import { WalkingPage } from './pages/WalkingPage.jsx'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: WalkingPage },
      { path: 'navigation', Component: NavigationPage },
      ...(import.meta.env.DEV
        ? [{ path: 'demo/navigation', Component: NavigationDemoPage }]
        : []),
      { path: 'settings', Component: SettingsPage },
      { path: 'authority', Component: AuthorityMapPage },
    ],
  },
])
