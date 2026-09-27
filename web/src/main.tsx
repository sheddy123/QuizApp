import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import SetsPage from './pages/SetsPage'
import ImportPage from './pages/ImportPage'
import QuizPage from './pages/QuizPage'
import ResultPage from './pages/ResultPage'
import './styles.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <SetsPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'attempts/:attemptId', element: <QuizPage /> },
      { path: 'attempts/:attemptId/result', element: <ResultPage /> }
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
