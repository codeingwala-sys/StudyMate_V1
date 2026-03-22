import { Routes, Route, Navigate } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import Home from '../pages/Home'
import SignIn from '../pages/SignIn'
import Settings from '../pages/Settings'
import LearnHub from '../pages/learn/LearnHub'
import NotesList from '../pages/learn/NotesList'
import NoteEditor from '../pages/learn/NoteEditor'
import Flashcards from '../pages/learn/Flashcards'
import VoiceOverview from '../pages/learn/VoiceOverview'
import MindMap from '../pages/learn/MindMap'
import PracticeHub from '../pages/practice/PracticeHub'
import ModeOne from '../pages/practice/ModeOne'
import ModeTwo from '../pages/practice/ModeTwo'
import Results from '../pages/practice/Results'
import FocusHub from '../pages/focus/FocusHub'
import ForestTimer from '../pages/focus/ForestTimer'
import DailyPlanner from '../pages/focus/DailyPlanner'
import ProgressHub from '../pages/progress/ProgressHub'

export default function Router() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
      <Route path="/*" element={
        <PageWrapper>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/learn" element={<LearnHub />} />
            <Route path="/learn/notes" element={<NotesList />} />
            <Route path="/learn/notes/new" element={<NoteEditor />} />
            <Route path="/learn/notes/:id" element={<NoteEditor />} />
            <Route path="/learn/flashcards" element={<Flashcards />} />
            <Route path="/learn/voice" element={<VoiceOverview />} />
            <Route path="/learn/mindmap" element={<MindMap />} />
            <Route path="/practice" element={<PracticeHub />} />
            <Route path="/practice/mode1" element={<ModeOne />} />
            <Route path="/practice/mode2" element={<ModeTwo />} />
            <Route path="/practice/results" element={<Results />} />
            <Route path="/focus" element={<FocusHub />} />
            <Route path="/focus/timer" element={<ForestTimer />} />
            <Route path="/focus/planner" element={<DailyPlanner />} />
            <Route path="/progress" element={<ProgressHub />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PageWrapper>
      } />
    </Routes>
  )
}