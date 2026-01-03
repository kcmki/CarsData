import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
})

export const STRIPE_PRICES = {
  perEvaluation: process.env.STRIPE_PRICE_PER_EVALUATION || "price_per_evaluation",
  monthlySubscription: process.env.STRIPE_PRICE_MONTHLY_SUBSCRIPTION || "price_monthly_subscription",
}
