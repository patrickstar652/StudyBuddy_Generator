import { Navigate, Routes, Route, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import DocumentPage from './pages/DocumentPage'
import QuizPage from './pages/QuizPage'
import FlashcardsPage from './pages/FlashcardsPage'
import SummaryPage from './pages/SummaryPage'

function KeyedDocumentRoute({ Component }) {
  const { docId } = useParams()
  return <Component key={docId} />
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/document/:docId" element={<KeyedDocumentRoute Component={DocumentPage} />} />
        <Route path="/quiz/:docId" element={<KeyedDocumentRoute Component={QuizPage} />} />
        <Route path="/flashcards/:docId" element={<KeyedDocumentRoute Component={FlashcardsPage} />} />
        <Route path="/summary/:docId" element={<KeyedDocumentRoute Component={SummaryPage} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
