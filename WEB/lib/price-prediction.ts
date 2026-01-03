import type { AdsLbc, AdsMobilede } from "@prisma/client"

type Car = AdsLbc | AdsMobilede

/**
 * Simple linear regression implementation for price prediction
 * Uses features: year, mileage, horsepower, doors, seats
 */
export function predictCarPrice(
  targetCar: {
    year: string
    mileage: number
    horsepower?: number
    doors?: number
    seats?: number
  },
  similarCars: Car[],
): {
  predictedPrice: number
  priceRangeMin: number
  priceRangeMax: number
  confidence: number
} {
  if (similarCars.length === 0) {
    // No similar cars found - return a default estimate
    return {
      predictedPrice: 15000,
      priceRangeMin: 10000,
      priceRangeMax: 20000,
      confidence: 0,
    }
  }

  const targetYear = parseInt(targetCar.year.split("-")[0]) || parseInt(targetCar.year)

  // Prepare training data
  const features = similarCars.map((car) => {
    const carYear = parseInt(car.regdate?.split("-")[0] || "0") || 0
    return {
      year: carYear,
      mileage: car.mileage || 0,
      horsepower: car.horsepowerDin || 100,
      doors: car.doors || 4,
      seats: car.seats || 5,
      price: Number(car.price),
    }
  })

  // Calculate feature statistics for normalization
  const yearMean = features.reduce((sum, f) => sum + f.year, 0) / features.length
  const mileageMean = features.reduce((sum, f) => sum + f.mileage, 0) / features.length
  const horsepowerMean = features.reduce((sum, f) => sum + f.horsepower, 0) / features.length
  const doorsMean = features.reduce((sum, f) => sum + f.doors, 0) / features.length
  const seatsMean = features.reduce((sum, f) => sum + f.seats, 0) / features.length

  const yearStd = Math.sqrt(
    features.reduce((sum, f) => sum + Math.pow(f.year - yearMean, 2), 0) / features.length,
  )
  const mileageStd = Math.sqrt(
    features.reduce((sum, f) => sum + Math.pow(f.mileage - mileageMean, 2), 0) / features.length,
  )
  const horsepowerStd = Math.sqrt(
    features.reduce((sum, f) => sum + Math.pow(f.horsepower - horsepowerMean, 2), 0) / features.length,
  )
  const doorsStd = Math.sqrt(
    features.reduce((sum, f) => sum + Math.pow(f.doors - doorsMean, 2), 0) / features.length,
  )
  const seatsStd = Math.sqrt(
    features.reduce((sum, f) => sum + Math.pow(f.seats - seatsMean, 2), 0) / features.length,
  )

  // Normalize features
  const normalizedFeatures = features.map((f) => ({
    year: yearStd > 0 ? (f.year - yearMean) / yearStd : 0,
    mileage: mileageStd > 0 ? (f.mileage - mileageMean) / mileageStd : 0,
    horsepower: horsepowerStd > 0 ? (f.horsepower - horsepowerMean) / horsepowerStd : 0,
    doors: doorsStd > 0 ? (f.doors - doorsMean) / doorsStd : 0,
    seats: seatsStd > 0 ? (f.seats - seatsMean) / seatsStd : 0,
    price: f.price,
  }))

  // Simple linear regression using normal equation
  // Features matrix X (with bias term)
  const n = normalizedFeatures.length
  const X: number[][] = normalizedFeatures.map((f) => [1, f.year, f.mileage, f.horsepower, f.doors, f.seats])
  const y: number[] = normalizedFeatures.map((f) => f.price)

  // Calculate coefficients using weighted average approach (simplified)
  const weights = calculateWeights(X, y)

  // Normalize target car features
  const targetHorsepower = targetCar.horsepower || 100
  const targetDoors = targetCar.doors || 4
  const targetSeats = targetCar.seats || 5
  
  const targetYearNorm = yearStd > 0 ? (targetYear - yearMean) / yearStd : 0
  const targetMileageNorm = mileageStd > 0 ? (targetCar.mileage - mileageMean) / mileageStd : 0
  const targetHorsepowerNorm = horsepowerStd > 0 ? (targetHorsepower - horsepowerMean) / horsepowerStd : 0
  const targetDoorsNorm = doorsStd > 0 ? (targetDoors - doorsMean) / doorsStd : 0
  const targetSeatsNorm = seatsStd > 0 ? (targetSeats - seatsMean) / seatsStd : 0

  // Predict price
  const predictedPrice = Math.max(
    0,
    weights[0] + 
    weights[1] * targetYearNorm + 
    weights[2] * targetMileageNorm + 
    weights[3] * targetHorsepowerNorm +
    weights[4] * targetDoorsNorm +
    weights[5] * targetSeatsNorm,
  )

  // Calculate price range and confidence based on similar cars
  const prices = features.map((f) => f.price).sort((a, b) => a - b)
  const priceStd = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - predictedPrice, 2), 0) / prices.length)

  const priceRangeMin = Math.max(0, predictedPrice - priceStd)
  const priceRangeMax = predictedPrice + priceStd

  // Confidence based on sample size and variance
  const confidence = Math.min(1, similarCars.length / 50) * (1 - Math.min(1, priceStd / predictedPrice))

  return {
    predictedPrice: Math.round(predictedPrice),
    priceRangeMin: Math.round(priceRangeMin),
    priceRangeMax: Math.round(priceRangeMax),
    confidence: Math.max(0, Math.min(1, confidence)),
  }
}

/**
 * Calculate regression weights using simplified approach
 */
function calculateWeights(X: number[][], y: number[]): number[] {
  const n = X.length
  const m = X[0].length

  // Initialize weights
  const weights = new Array(m).fill(0)

  // Calculate mean price
  const yMean = y.reduce((sum, val) => sum + val, 0) / n
  weights[0] = yMean // Intercept

  // Calculate feature-price correlations (simplified)
  for (let j = 1; j < m; j++) {
    let numerator = 0
    let denominator = 0

    for (let i = 0; i < n; i++) {
      numerator += X[i][j] * (y[i] - yMean)
      denominator += X[i][j] * X[i][j]
    }

    weights[j] = denominator > 0 ? numerator / denominator : 0
  }

  return weights
}
