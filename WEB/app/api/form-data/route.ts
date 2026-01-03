import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Cache for form data to reduce database hits
let formDataCache: any = null
let lastCacheTime = 0
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brand = searchParams.get("brand")
    const country = searchParams.get("country")

    // If brand is specified, return models for that brand from both tables (optimized with UNION)
    if (brand) {
      // Use raw SQL UNION query for better performance
      const models = await prisma.$queryRaw`
        SELECT DISTINCT carModel FROM (
          SELECT car_model as carModel FROM ads_lbc WHERE car_brand = ${brand} AND car_model IS NOT NULL
          UNION
          SELECT car_model as carModel FROM ads_mobilede WHERE car_brand = ${brand} AND car_model IS NOT NULL
        ) as combined
        ORDER BY carModel ASC
      `
      
      return NextResponse.json({
        models: (models as any[]).map(m => m.carModel).filter(Boolean),
      })
    }

    // If country is specified, return cities for that country from both tables (optimized with UNION)
    if (country) {
      const cities = await prisma.$queryRaw`
        SELECT DISTINCT locationCity FROM (
          SELECT location_city as locationCity FROM ads_lbc WHERE location_country_id = ${country} AND location_city IS NOT NULL
          UNION
          SELECT location_city as locationCity FROM ads_mobilede WHERE location_country_id = ${country} AND location_city IS NOT NULL
        ) as combined
        ORDER BY locationCity ASC
      `
      
      return NextResponse.json({
        cities: (cities as any[]).map(c => c.locationCity).filter(Boolean),
      })
    }

    // Check cache for full form data
    const now = Date.now()
    if (formDataCache && (now - lastCacheTime) < CACHE_DURATION) {
      return NextResponse.json(formDataCache)
    }

    // Fetch distinct values from both tables using UNION queries (much more efficient)
    const [brands, colors, countries_data, fuelTypes, gearboxTypes] = await Promise.all([
      // Get distinct car brands using UNION
      prisma.$queryRaw`
        SELECT DISTINCT carBrand FROM (
          SELECT car_brand as carBrand FROM ads_lbc WHERE car_brand IS NOT NULL
          UNION
          SELECT car_brand as carBrand FROM ads_mobilede WHERE car_brand IS NOT NULL
        ) as combined
        ORDER BY carBrand ASC
      `,
      
      // Get distinct colors using UNION
      prisma.$queryRaw`
        SELECT DISTINCT vehiculeColor FROM (
          SELECT vehicule_color as vehiculeColor FROM ads_lbc WHERE vehicule_color IS NOT NULL
          UNION
          SELECT vehicule_color as vehiculeColor FROM ads_mobilede WHERE vehicule_color IS NOT NULL
        ) as combined
        ORDER BY vehiculeColor ASC
      `,
      
      // Get distinct countries using UNION
      prisma.$queryRaw`
        SELECT DISTINCT locationCountryId FROM (
          SELECT location_country_id as locationCountryId FROM ads_lbc WHERE location_country_id IS NOT NULL
          UNION
          SELECT location_country_id as locationCountryId FROM ads_mobilede WHERE location_country_id IS NOT NULL
        ) as combined
        ORDER BY locationCountryId ASC
      `,
      
      // Get distinct fuel types using UNION
      prisma.$queryRaw`
        SELECT DISTINCT fuelLabel FROM (
          SELECT fuel_label as fuelLabel FROM ads_lbc WHERE fuel_label IS NOT NULL
          UNION
          SELECT fuel_label as fuelLabel FROM ads_mobilede WHERE fuel_label IS NOT NULL
        ) as combined
        ORDER BY fuelLabel ASC
      `,
      
      // Get distinct gearbox types using UNION
      prisma.$queryRaw`
        SELECT DISTINCT gearboxLabel FROM (
          SELECT gearbox_label as gearboxLabel FROM ads_lbc WHERE gearbox_label IS NOT NULL
          UNION
          SELECT gearbox_label as gearboxLabel FROM ads_mobilede WHERE gearbox_label IS NOT NULL
        ) as combined
        ORDER BY gearboxLabel ASC
      `,
    ])

    // Extract values from raw query results
    const result = {
      brands: (brands as any[]).map(b => b.carBrand).filter(Boolean),
      colors: (colors as any[]).map(c => c.vehiculeColor).filter(Boolean),
      countries: (countries_data as any[]).map(c => c.locationCountryId).filter(Boolean),
      fuelTypes: (fuelTypes as any[]).map(f => f.fuelLabel).filter(Boolean),
      gearboxTypes: (gearboxTypes as any[]).map(g => g.gearboxLabel).filter(Boolean),
    }

    // Cache the result
    formDataCache = result
    lastCacheTime = now

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching form data:", error)
    return NextResponse.json({ error: "Failed to fetch form data" }, { status: 500 })
  }
}
