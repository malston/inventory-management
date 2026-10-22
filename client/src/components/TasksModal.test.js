import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TasksModal from './TasksModal.vue'
import { useI18n } from '../composables/useI18n'

function task(id, dueDate, status = 'pending') {
  return { id, title: `Task ${id}`, priority: 'medium', dueDate, status }
}

function mountWith(tasks) {
  return mount(TasksModal, {
    props: { isOpen: true, tasks },
    global: { stubs: { teleport: true } }
  })
}

function rows(wrapper) {
  return wrapper.findAll('.task-item').map((item) => ({
    due: item.find('.task-due-date').text(),
    status: item.find('.status-badge').text()
  }))
}

describe('TasksModal due dates', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 22, 10, 0))
    useI18n().setLocale('en')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('labels due dates relative to today without shifting a day', () => {
    const wrapper = mountWith([
      task(1, '2026-10-22'),
      task(2, '2026-10-23'),
      task(3, '2026-10-21'),
      task(4, '2026-10-25')
    ])

    expect(rows(wrapper).map((r) => r.due)).toEqual([
      'today',
      'tomorrow',
      'yesterday',
      'in 3 days'
    ])
  })

  it('shows the calendar date for due dates a week or more away', () => {
    const wrapper = mountWith([task(1, '2026-12-25'), task(2, '2027-01-15')])

    expect(rows(wrapper).map((r) => r.due)).toEqual(['Dec 25', 'Jan 15, 2027'])
  })

  it('marks a task due today as due soon, not overdue', () => {
    const wrapper = mountWith([
      task(1, '2026-10-22'),
      task(2, '2026-10-21'),
      task(3, '2026-11-30'),
      task(4, '2026-10-21', 'completed')
    ])

    expect(rows(wrapper).map((r) => r.status)).toEqual([
      'Due Soon',
      'Overdue',
      'Upcoming',
      'Completed'
    ])
  })
})
