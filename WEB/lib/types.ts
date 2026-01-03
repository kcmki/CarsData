export interface User {
  id: string
  email?: string
  phone?: string
  is_verified: boolean
  free_evaluation_used: boolean
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  status: "active" | "canceled" | "past_due" | "trialing"
  plan_type: "monthly" | "yearly"
  current_period_start: string
  current_period_end: string
  created_at: string
  updated_at: string
}

export interface Evaluation {
  id: string
  user_id: string
  make: string
  model: string
  year: number
  mileage: number
  condition: "excellent" | "good" | "fair" | "poor"
  fuel_type?: string
  transmission?: string
  color?: string
  additional_features?: Record<string, any>
  estimated_price?: number
  price_range_min?: number
  price_range_max?: number
  evaluation_notes?: string
  is_paid: boolean
  payment_amount?: number
  stripe_payment_id?: string
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  user_id: string
  evaluation_id?: string
  stripe_payment_intent_id?: string
  amount: number
  currency: string
  status: "pending" | "succeeded" | "failed" | "canceled"
  created_at: string
  updated_at: string
}
