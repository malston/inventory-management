<template>
  <div class="restocking">
    <div class="page-header">
      <h2>{{ t('restocking.title') }}</h2>
      <p>{{ t('restocking.description') }}</p>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">{{ t('restocking.budget') }}</h3>
          <span class="budget-max">{{ t('restocking.fullRestockCost', { amount: formatCurrency(fullRestockCost) }) }}</span>
        </div>
        <div class="budget-control">
          <input
            v-model.number="budget"
            type="range"
            min="0"
            :max="sliderMax"
            :step="BUDGET_STEP"
            class="budget-slider"
            :aria-label="t('restocking.budget')"
          />
          <span class="budget-value">{{ formatCurrency(budget) }}</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card info">
          <div class="stat-label">{{ t('restocking.totalCost') }}</div>
          <div class="stat-value">{{ formatCurrency(recommendation.total_cost) }}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">{{ t('restocking.remainingBudget') }}</div>
          <div class="stat-value">{{ formatCurrency(recommendation.remaining_budget) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('restocking.itemCount') }}</div>
          <div class="stat-value">{{ recommendation.items.length }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">{{ t('restocking.recommendations') }} ({{ recommendation.items.length }})</h3>
          <button
            class="place-order-btn"
            :disabled="!canPlaceOrder"
            @click="placeOrder"
          >
            {{ submitting ? t('restocking.placingOrder') : t('restocking.placeOrder') }}
          </button>
        </div>

        <div v-if="submitError" class="error">{{ submitError }}</div>
        <div v-if="placedOrder" class="confirmation">
          {{ t('restocking.orderPlaced', {
            orderNumber: placedOrder.order_number,
            date: formatDate(placedOrder.expected_delivery_date)
          }) }}
          <router-link to="/orders" class="confirmation-link">{{ t('restocking.viewOrders') }}</router-link>
        </div>

        <div v-if="recommendation.items.length === 0" class="empty-state">
          {{ t('restocking.empty') }}
        </div>
        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>{{ t('restocking.table.sku') }}</th>
                <th>{{ t('restocking.table.name') }}</th>
                <th>{{ t('restocking.table.trend') }}</th>
                <th class="num">{{ t('restocking.table.quantity') }}</th>
                <th class="num">{{ t('restocking.table.unitCost') }}</th>
                <th class="num">{{ t('restocking.table.lineTotal') }}</th>
                <th class="num">{{ t('restocking.table.leadTime') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in recommendation.items" :key="item.item_sku">
                <td><strong>{{ item.item_sku }}</strong></td>
                <td>{{ translateProductName(item.item_name) }}</td>
                <td>
                  <span :class="['badge', item.trend]">{{ t(`trends.${item.trend}`) }}</span>
                </td>
                <td class="num">{{ item.quantity.toLocaleString() }}</td>
                <td class="num">{{ formatCurrency(item.unit_cost) }}</td>
                <td class="num"><strong>{{ formatCurrency(item.line_total) }}</strong></td>
                <td class="num">{{ item.lead_time_days }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'
import { parseDate } from '../utils/date'

const BUDGET_STEP = 500
const INITIAL_BUDGET = 1000
const DEBOUNCE_MS = 250

export default {
  name: 'Restocking',
  setup() {
    const { t, currentCurrency, currentLocale, translateProductName } = useI18n()

    const currencySymbol = computed(() => {
      return currentCurrency.value === 'JPY' ? '¥' : '$'
    })

    const loading = ref(true)
    const error = ref(null)
    const budget = ref(INITIAL_BUDGET)
    const fullRestockCost = ref(0)
    const recommendation = ref({ budget: 0, items: [], total_cost: 0, remaining_budget: 0 })
    const refreshing = ref(false)
    const submitting = ref(false)
    const submitError = ref(null)
    const placedOrder = ref(null)

    const sliderMax = computed(() => {
      return Math.ceil(fullRestockCost.value / BUDGET_STEP) * BUDGET_STEP
    })

    const canPlaceOrder = computed(() => {
      return recommendation.value.items.length > 0 && !submitting.value && !refreshing.value
    })

    const formatCurrency = (value) => {
      return `${currencySymbol.value}${Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`
    }

    const formatDate = (dateString) => {
      const date = parseDate(dateString)
      if (isNaN(date.getTime())) return dateString
      const locale = currentLocale.value === 'ja' ? 'ja-JP' : 'en-US'
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
    }

    // Only the most recent request may update the table; earlier responses that
    // arrive late are discarded.
    let latestRequest = 0
    const loadRecommendation = async () => {
      const requestId = ++latestRequest
      refreshing.value = true
      try {
        const result = await api.getRestockRecommendations(budget.value)
        if (requestId !== latestRequest) return
        recommendation.value = result
        fullRestockCost.value = result.full_restock_cost
        error.value = null
      } catch (err) {
        if (requestId !== latestRequest) return
        error.value = t('restocking.loadError') + ': ' + err.message
      } finally {
        if (requestId === latestRequest) refreshing.value = false
      }
    }

    let debounceTimer = null
    watch(budget, () => {
      placedOrder.value = null
      submitError.value = null
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(loadRecommendation, DEBOUNCE_MS)
    })

    const placeOrder = async () => {
      submitting.value = true
      submitError.value = null
      placedOrder.value = null
      try {
        placedOrder.value = await api.createRestockOrder(recommendation.value.budget)
      } catch (err) {
        submitError.value = err.response?.data?.detail || t('restocking.orderError')
      } finally {
        submitting.value = false
      }
    }

    onMounted(async () => {
      await loadRecommendation()
      loading.value = false
      // Slider range is known only after the first response; keep the starting
      // budget inside it.
      if (budget.value > sliderMax.value) {
        budget.value = sliderMax.value
      }
    })

    onBeforeUnmount(() => clearTimeout(debounceTimer))

    return {
      t,
      BUDGET_STEP,
      loading,
      error,
      budget,
      fullRestockCost,
      sliderMax,
      recommendation,
      submitting,
      submitError,
      placedOrder,
      canPlaceOrder,
      formatCurrency,
      formatDate,
      placeOrder,
      translateProductName
    }
  }
}
</script>

<style scoped>
.budget-control {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.budget-slider {
  flex: 1;
  accent-color: #0f172a;
}

.budget-value {
  min-width: 120px;
  text-align: right;
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.budget-max {
  color: #64748b;
  font-size: 0.875rem;
}

.num {
  text-align: right;
}

.place-order-btn {
  background: #0f172a;
  color: white;
  border: 1px solid #0f172a;
  border-radius: 8px;
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.place-order-btn:hover:not(:disabled) {
  background: #1e293b;
}

.place-order-btn:disabled {
  background: #e2e8f0;
  border-color: #e2e8f0;
  color: #64748b;
  cursor: not-allowed;
}

.confirmation {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #065f46;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  font-size: 0.938rem;
}

.confirmation-link {
  margin-left: 0.5rem;
  color: #2563eb;
  font-weight: 500;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
  font-size: 0.938rem;
}
</style>
