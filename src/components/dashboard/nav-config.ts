import {
  Home,
  MessageSquare,
  Calendar,
  FileText,
  CheckSquare,
  BookOpen,
  GraduationCap,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { label: '대시보드', href: '/office', icon: Home },
  { label: 'AI 어시스턴트', href: '/office/chat', icon: MessageSquare },
  { label: '캘린더', href: '/office/calendar', icon: Calendar },
  { label: '세특 작성 도우미', href: '/office/setuk', icon: FileText },
  { label: '학생부 검수', href: '/office/review', icon: CheckSquare },
  { label: '학교 규정 안내', href: '/office/rules', icon: BookOpen },
  // { label: '상담 기록', href: '/office/consult', icon: Users }, // 임시 숨김
  { label: '세특입력활동 관리', href: '/office/activity', icon: GraduationCap },
  { label: '관리자 설정', href: '/office/admin', icon: Settings, adminOnly: true },
]
