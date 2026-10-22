import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import Restocking from './Restocking.vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'

vi.mock('../api', () => ({
  api: {
    getRestockRecommendations: vi.fn(),
    createRestockOrder: vi.fn()
  }
}))

const FLT = {
  item_sku: 'FLT-405',
  item_name: 'Oil Filter Cartridge',
  trend: 'increasing',
  quantity: 150,
  unit_cost: 6.4,
  line_total: 960,
  lead_time_days: 7
}
const WDG = {
  item_sku: 'WDG-001',
  item_name: 'Industrial Widget Type A',
  trend: 'increasing',
  quantity: 3,
  unit_cost: 12.5,
  line_total: 37.5,
  lead_time_days: 14
}

function recommendation(budget, items, totalCost) {
  return {
    budget,
    items,
    total_cost: totalCost,
    remaining_budget: budget - totalCost,
    full_restock_cost: 4136.98
  }
}

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function mountView() {
  const wrapper = mount(Restocking, {
    global: { stubs: { RouterLink: RouterLinkStub } }
  })
  await flushPromises()
  return wrapper
}

async function moveSlider(wrapper, value) {
  await wrapper.find('input[type="range"]').setValue(value)
  vi.advanceTimersByTime(250)
  await flushPromises()
}

const skus = (wrapper) =>
  wrapper.findAll('tbody tr').map((row) => row.find('td').text())
const placeOrderButton = (wrapper) => wrapper.find('.place-order-btn')

describe('Restocking view', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    useI18n().setLocale('en')
    api.getRestockRecommendations.mockReset()
    api.createRestockOrder.mockReset()
    api.getRestockRecommendations.mockResolvedValue(
      recommendation(1000, [FLT, WDG], 997.5)
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads recommendations for the starting budget', async () => {
    const wrapper = await mountView()

    expect(api.getRestockRecommendations).toHaveBeenCalledWith(1000)
    expect(skus(wrapper)).toEqual(['FLT-405', 'WDG-001'])
    const stats = wrapper.findAll('.stat-value').map((s) => s.text())
    expect(stats).toEqual(['$997.50', '$2.50', '2'])
  })

  it('sets the slider max to the full restock cost rounded up to $500', async () => {
    const wrapper = await mountView()

    const slider = wrapper.find('input[type="range"]')
    expect(slider.attributes('max')).toBe('4500')
    expect(slider.attributes('step')).toBe('500')
  })

  it('sends one request with the last budget after rapid slider moves', async () => {
    const wrapper = await mountView()
    api.getRestockRecommendations.mockClear()
    api.getRestockRecommendations.mockResolvedValue(
      recommendation(3000, [FLT], 960)
    )

    const slider = wrapper.find('input[type="range"]')
    for (const value of [1500, 2000, 2500, 3000]) {
      await slider.setValue(value)
      vi.advanceTimersByTime(100)
    }
    expect(api.getRestockRecommendations).not.toHaveBeenCalled()

    vi.advanceTimersByTime(250)
    await flushPromises()
    expect(api.getRestockRecommendations).toHaveBeenCalledTimes(1)
    expect(api.getRestockRecommendations).toHaveBeenCalledWith(3000)
  })

  it('ignores a slow response that arrives after a newer one', async () => {
    const wrapper = await mountView()
    const slow = deferred()
    const fast = deferred()
    api.getRestockRecommendations
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise)

    await moveSlider(wrapper, 2000)
    await moveSlider(wrapper, 500)

    fast.resolve(recommendation(500, [FLT], 960))
    await flushPromises()
    slow.resolve(recommendation(2000, [FLT, WDG], 1997.5))
    await flushPromises()

    expect(skus(wrapper)).toEqual(['FLT-405'])
  })

  it('shows an empty state and disables Place Order when nothing fits', async () => {
    api.getRestockRecommendations.mockResolvedValue(recommendation(0, [], 0))
    const wrapper = await mountView()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(placeOrderButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('disables Place Order while a refresh is in flight', async () => {
    const wrapper = await mountView()
    const pending = deferred()
    api.getRestockRecommendations.mockReturnValueOnce(pending.promise)

    await moveSlider(wrapper, 2000)
    expect(placeOrderButton(wrapper).attributes('disabled')).toBeDefined()

    pending.resolve(recommendation(2000, [FLT, WDG], 1997.5))
    await flushPromises()
    expect(placeOrderButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('shows a page-level error when the first load fails', async () => {
    api.getRestockRecommendations.mockRejectedValue(new Error('Network Error'))
    const wrapper = await mountView()

    expect(wrapper.find('.error').text()).toContain('Network Error')
    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
  })

  it('keeps the slider usable after a failed refresh and clears the error on the next success', async () => {
    const wrapper = await mountView()
    api.getRestockRecommendations.mockRejectedValueOnce(
      new Error('Network Error')
    )

    await moveSlider(wrapper, 2000)
    expect(wrapper.find('input[type="range"]').exists()).toBe(true)
    expect(wrapper.find('.error').text()).toContain('Network Error')

    api.getRestockRecommendations.mockResolvedValueOnce(
      recommendation(2500, [FLT, WDG], 2497.5)
    )
    await moveSlider(wrapper, 2500)
    expect(wrapper.find('.error').exists()).toBe(false)
    expect(wrapper.findAll('.stat-value')[0].text()).toBe('$2,497.50')
  })

  it('places the order for the budget shown and confirms it', async () => {
    api.createRestockOrder.mockResolvedValue({
      order_number: 'RST-0007',
      expected_delivery_date: '2026-11-05'
    })
    const wrapper = await mountView()

    await placeOrderButton(wrapper).trigger('click')
    await flushPromises()

    expect(api.createRestockOrder).toHaveBeenCalledWith(1000)
    const confirmation = wrapper.find('.confirmation').text()
    expect(confirmation).toContain('RST-0007')
    expect(confirmation).toContain('Nov 5, 2026')
  })

  it('shows the server error message when placing the order fails', async () => {
    api.createRestockOrder.mockRejectedValue({
      response: { data: { detail: 'No items fit within the budget' } }
    })
    const wrapper = await mountView()

    await placeOrderButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('.error').text()).toBe('No items fit within the budget')
    expect(wrapper.find('.confirmation').exists()).toBe(false)
  })

  it('converts amounts to yen in Japanese mode', async () => {
    useI18n().setLocale('ja')
    const wrapper = await mountView()

    expect(wrapper.find('.budget-value').text()).toBe('¥150,000')
    expect(wrapper.findAll('.stat-value')[0].text()).toBe('¥149,625')
  })
})
