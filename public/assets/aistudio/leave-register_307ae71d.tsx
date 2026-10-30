'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardList, LogIn, LogOut } from 'lucide-react'
import { leaveReasons, type Student } from '@/components/dashboard/data'
import { Panel, fieldClassName } from '@/components/dashboard/panel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const MAX_WORDS = 1000

type Tab = 'application' | 'return'

const tabs: { id: Tab; label: string; icon: typeof LogOut }[] = [
  { id: 'application', label: 'Leave Registration', icon: LogOut },
  { id: 'return', label: 'Return Registry', icon: LogIn },
]

function countWords(text: string) {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function LeaveRegister({ student }: { student: Student }) {
  const [activeTab, setActiveTab] = useState<Tab>('application')

  return (
    <Panel
      id="leave"
      eyebrow={`${student.name} · ${student.admissionNo}`}
      title="Leave Register"
      icon={ClipboardList}
      className="border-lime/20"
    >
      <div
        role="tablist"
        aria-label="Leave register"
        className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/60 p-1"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`leave-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`leave-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                selected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <tab.icon className="size-4" aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`leave-panel-${activeTab}`}
        aria-labelledby={`leave-tab-${activeTab}`}
        className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
        key={`${activeTab}-${student.id}`}
      >
        {activeTab === 'application' ? <LeaveApplicationForm /> : <ReturnRegistryForm />}
      </div>
    </Panel>
  )
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-lg border border-lime/30 bg-lime/10 px-3 py-2.5 text-sm text-lime animate-in fade-in-0 duration-300"
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function getCurrentDateTime() {
  const now = new Date()
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

function LeaveApplicationForm() {
  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const showDetails = reason === 'Other'
  const words = countWords(details)
  const overLimit = showDetails && words > MAX_WORDS

  function fillCurrentDateTime() {
    const { date, time } = getCurrentDateTime()
    setDepartureDate(date)
    setDepartureTime(time)
  }

  // Filled after mount so the server-rendered markup matches the first client render.
  useEffect(fillCurrentDateTime, [])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (overLimit) return
    setSubmitted(true)
    setReason('')
    setDetails('')
    fillCurrentDateTime()
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setSubmitted(false)} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="departure-date">Departure date</Label>
          <input
            id="departure-date"
            name="departureDate"
            type="date"
            required
            value={departureDate}
            onChange={(event) => setDepartureDate(event.target.value)}
            className={fieldClassName}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="departure-time">Departure time</Label>
          <input
            id="departure-time"
            name="departureTime"
            type="time"
            required
            value={departureTime}
            onChange={(event) => setDepartureTime(event.target.value)}
            className={fieldClassName}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="leave-reason">Reason</Label>
        <select
          id="leave-reason"
          name="reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={cn(fieldClassName, 'cursor-pointer')}
        >
          <option value="" disabled>
            Select a reason
          </option>
          {leaveReasons.map((reason) => (
            <option key={reason} value={reason} className="bg-card">
              {reason}
            </option>
          ))}
        </select>
      </div>

      {showDetails ? (
      <div className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-top-1 duration-300">
        <div className="flex items-center justify-between">
          <Label htmlFor="leave-details">Detailed reason</Label>
          <span
            id="leave-details-count"
            className={cn('text-xs tabular-nums', overLimit ? 'text-destructive' : 'text-muted-foreground')}
          >
            {words} / {MAX_WORDS} words
          </span>
        </div>
        <textarea
          id="leave-details"
          name="details"
          rows={6}
          required
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Max 1000 words"
          aria-describedby="leave-details-count"
          aria-invalid={overLimit || undefined}
          className={cn(fieldClassName, 'h-auto min-h-36 resize-y py-3 leading-relaxed')}
        />
      </div>
      ) : null}

      {submitted ? <SuccessMessage message="Leave registration submitted for warden approval." /> : null}

      <Button type="submit" disabled={overLimit} className="h-11 rounded-full font-semibold sm:self-end sm:px-8">
        Submit Registration
      </Button>
    </form>
  )
}

function ReturnRegistryForm() {
  const [returnDate, setReturnDate] = useState('')
  const [returnTime, setReturnTime] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function fillCurrentDateTime() {
    const { date, time } = getCurrentDateTime()
    setReturnDate(date)
    setReturnTime(time)
  }

  // Filled after mount so the server-rendered markup matches the first client render.
  useEffect(fillCurrentDateTime, [])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    fillCurrentDateTime()
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setSubmitted(false)} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="return-date">Return date</Label>
          <input
            id="return-date"
            name="returnDate"
            type="date"
            required
            value={returnDate}
            onChange={(event) => setReturnDate(event.target.value)}
            className={fieldClassName}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="return-time">Return time</Label>
          <input
            id="return-time"
            name="returnTime"
            type="time"
            required
            value={returnTime}
            onChange={(event) => setReturnTime(event.target.value)}
            className={fieldClassName}
          />
        </div>
      </div>

      {submitted ? <SuccessMessage message="Return registered. Welcome back to campus." /> : null}

      <Button type="submit" className="h-11 rounded-full font-semibold sm:self-end sm:px-8">
        Register return
      </Button>
    </form>
  )
}
