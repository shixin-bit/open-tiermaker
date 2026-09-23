import { Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage'
import { BoardListPage } from '@/pages/BoardListPage'
import { NewBoardPage } from '@/pages/NewBoardPage'
import { EditBoardPage } from '@/pages/EditBoardPage'
import { SharedBoardPage } from '@/pages/SharedBoardPage'
import { AuthModal } from '@/components/AuthModal'

export default function App() {
  return (
    <>
      <AuthModal />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/boards" element={<BoardListPage />} />
        <Route path="/boards/new" element={<NewBoardPage />} />
        <Route path="/boards/:id" element={<EditBoardPage />} />
        <Route path="/boards/local/:id" element={<EditBoardPage forceLocal />} />
        <Route path="/share/:shareId" element={<SharedBoardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
