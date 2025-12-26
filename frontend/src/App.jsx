import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import DocumentPage from './pages/DocumentPage'
import QuizPage from './pages/QuizPage'
import FlashcardsPage from './pages/FlashcardsPage'
import SummaryPage from './pages/SummaryPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/document/:docId" element={<DocumentPage />} />
        <Route path="/quiz/:docId" element={<QuizPage />} />
        <Route path="/flashcards/:docId" element={<FlashcardsPage />} />
        <Route path="/summary/:docId" element={<SummaryPage />} />
      </Routes>
    </Layout>
  )
}

export default App
