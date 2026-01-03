import { prisma } from "./prisma"
import type { AdsLbc, AdsMobilede } from "@prisma/client"

type Car = AdsLbc | AdsMobilede

/**
 * Find similar cars based on brand, model, and year range (±1 year)
 * Optimized: Year filtering now happens at SQL level instead of in JavaScript
 */
export async function findSimilarCars(
  brand: string,
  model: string,
  year: string,
): Promise<Car[]> {
  // Extract numeric year from regdate
  const targetYear = parseInt(year.split("-")[0]) || parseInt(year)
  const minYear = targetYear - 1
  const maxYear = targetYear + 1

  // Use optimized SQL query with UNION instead of fetching and filtering in JS
  const cars = await prisma.$queryRaw<Car[]>`
    SELECT * FROM (
      SELECT *, 'lbc' as source FROM ads_lbc 
      WHERE LOWER(car_brand) = LOWER(${brand})
      AND LOWER(car_model) = LOWER(${model})
      AND regdate IS NOT NULL
      AND YEAR(STR_TO_DATE(regdate, '%Y-%m-%d')) BETWEEN ${minYear} AND ${maxYear}
      
      UNION ALL
      
      SELECT *, 'mobilede' as source FROM ads_mobilede 
      WHERE LOWER(car_brand) = LOWER(${brand})
      AND LOWER(car_model) = LOWER(${model})
      AND regdate IS NOT NULL
      AND YEAR(STR_TO_DATE(regdate, '%Y-%m-%d')) BETWEEN ${minYear} AND ${maxYear}
    ) as combined
    ORDER BY regdate DESC, mileage ASC
    LIMIT 1000
  `

  return cars as Car[]
}

/**
 * Find the N closest cars to the target car using SQL-based distance calculation
 * This is much more efficient than JavaScript calculations
 */
export async function findClosestCarsOptimized(
  targetCar: {
    year: string
    mileage: number
    price: number
    horsepower?: number
    brand?: string
    model?: string
  },
  count: number = 10,
): Promise<Car[]> {
  const targetYear = parseInt(targetCar.year.split("-")[0]) || parseInt(targetCar.year)
  const horsepowerFilter = targetCar.horsepower ? `AND horsepower_din IS NOT NULL` : ""

  // Use SQL to calculate distance and sort - much faster than JavaScript
  const cars = await prisma.$queryRaw<(Car & { distance: number })[]>`
    SELECT *, 
      SQRT(
        POW(YEAR(STR_TO_DATE(regdate, '%Y-%m-%d')) - ${targetYear}, 2) +
        POW((mileage - ${targetCar.mileage}) / 10000, 2) +
        POW((price - ${targetCar.price}) / 1000, 2)
        ${
          targetCar.horsepower
            ? `+ POW((horsepower_din - ${targetCar.horsepower}) / 100, 2)`
            : ""
        }
      ) as distance
    FROM (
      SELECT * FROM ads_lbc 
      WHERE regdate IS NOT NULL ${horsepowerFilter}
      
      UNION ALL
      
      SELECT * FROM ads_mobilede 
      WHERE regdate IS NOT NULL ${horsepowerFilter}
    ) as combined
    ORDER BY distance ASC
    LIMIT ${count}
  `

  return cars as Car[]
}

/**
 * Fallback function that works with already-fetched cars
 * Used when we already have the similar cars data
 */
export function findClosestCars(
  targetCar: {
    year: string
    mileage: number
    price: number
    horsepower?: number
  },
  cars: Car[],
  count: number = 10,
): Car[] {
  const targetYear = parseInt(targetCar.year.split("-")[0]) || parseInt(targetCar.year)
  
  // Calculate distance score for each car
  const carsWithDistance = cars.map((car) => {
    const carYear = parseInt(car.regdate?.split("-")[0] || "0") || 0
    
    // Normalize differences
    const yearDiff = Math.abs(carYear - targetYear)
    const mileageDiff = Math.abs((car.mileage || 0) - targetCar.mileage) / 10000 // Scale mileage
    const priceDiff = Math.abs(Number(car.price) - targetCar.price) / 1000 // Scale price
    
    // Include horsepower if available
    let horsepowerDiff = 0
    if (targetCar.horsepower && car.horsepowerDin) {
      horsepowerDiff = Math.abs(car.horsepowerDin - targetCar.horsepower) / 100 // Scale horsepower
    }

    // Euclidean distance
    const distance = Math.sqrt(
      yearDiff ** 2 + 
      mileageDiff ** 2 + 
      priceDiff ** 2 + 
      horsepowerDiff ** 2
    )

    return { car, distance }
  })

  // Sort by distance and take the closest N
  return carsWithDistance
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((item) => item.car)
}
