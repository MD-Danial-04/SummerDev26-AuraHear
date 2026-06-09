import { createBrowserRouter } from 'react-router'

import { Root } from './components/Root.jsx'
import { NavigationPage } from './pages/NavigationPage.jsx'
import { WalkingPage } from './pages/WalkingPage.jsx'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: WalkingPage },
      { path: 'navigation', Component: NavigationPage },
    ],
  },
])
