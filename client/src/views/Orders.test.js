import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Orders from './Orders.vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'

vi.mock('../api', () => ({
  api: {
    getOrders: vi.fn(),
    getRestockOrders: vi.fn()
  }
}))

const CUSTOMER_ORDER = {
  id: '1',
  order_number: 'ORD-2025-0113',
  customer: 'FastAssembly Ltd',
  items: [
    {
      sku: 'PCB-001',
      name: 'Single Layer PCB Assembly',
      quantity: 2,
      unit_price: 12.5
    }
  ],
  status: 'Delivered',
  order_date: '2025-12-18T09:00:00',
  expected_delivery: '2025-12-27T09:00:00',
  total_value: 57513.5
}

const RESTOCK_ORDER = {
  id: 'restock-1',
  order_number: 'RST-0001',
  status: 'Submitted',
  created_date: '2026-10-22',
  items: [{ item_sku: 'FLT-405' }, { item_sku: 'WDG-001' }],
  total_cost: 2497.5,
  lead_time_days: 14,
  expected_delivery_date: '2026-11-05'
}

function submittedCard(wrapper) {
  return wrapper
    .findAll('.card')
    .find((card) =>
      card.find('.card-title').text().startsWith('Submitted Orders')
    )
}

describe('Orders view', () => {
  beforeEach(() => {
    useI18n().setLocale('en')
    api.getOrders.mockReset()
    api.getRestockOrders.mockReset()
    api.getOrders.mockResolvedValue([CUSTOMER_ORDER])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists submitted restock orders with lead time and delivery date', async () => {
    api.getRestockOrders.mockResolvedValue([RESTOCK_ORDER])
    const wrapper = mount(Orders)
    await flushPromises()

    const card = submittedCard(wrapper)
    expect(card.find('.card-title').text()).toBe('Submitted Orders (1)')
    const cells = card.findAll('tbody td').map((td) => td.text())
    expect(cells).toEqual([
      'RST-0001',
      'Oct 22, 2026',
      '2',
      '$2,497.50',
      '14',
      'Nov 5, 2026',
      'Submitted'
    ])
  })

  it('shows an empty state when no restock orders exist', async () => {
    api.getRestockOrders.mockResolvedValue([])
    const wrapper = mount(Orders)
    await flushPromises()

    const card = submittedCard(wrapper)
    expect(card.find('.empty-state').exists()).toBe(true)
    expect(card.find('.error').exists()).toBe(false)
  })

  it('shows an error, not the empty state, when restock orders fail to load', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.getRestockOrders.mockRejectedValue(new Error('Network Error'))
    const wrapper = mount(Orders)
    await flushPromises()

    const card = submittedCard(wrapper)
    expect(card.find('.error').text()).toBe('Failed to load submitted orders')
    expect(card.find('.empty-state').exists()).toBe(false)
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load restock orders:',
      expect.any(Error)
    )
  })

  it('shows customer order money with two decimal places', async () => {
    api.getRestockOrders.mockResolvedValue([])
    const wrapper = mount(Orders)
    await flushPromises()

    expect(wrapper.find('td.col-value').text()).toBe('$57,513.50')
    expect(wrapper.find('.item-meta').text()).toContain('@ $12.50')
  })
})
