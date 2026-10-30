import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export const metadata: Metadata = {
  title: "Student Dashboard — Da'wa College Portal | ICS Academy Manhappatta",
  description: 'Notices, attendance, leave register, timetable, library and exam results for Da’wa College students.',
}

export default function DashboardPage() {
  return <DashboardShell />
}
