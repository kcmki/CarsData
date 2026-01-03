import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { findSimilarCars, findClosestCars } from "@/lib/car-service"
import { predictCarPrice } from "@/lib/price-prediction"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      carBrand, 
      carModel, 
      regdate, 
      mileage, 
      fuelLabel, 
      gearboxLabel, 
      vehiculeColor,
      subject,
      locationCountryId,
      locationCity,
      doors,
      seats,
      horsepowerDin,
      userId 
    } = body

    // Validate required fields
    if (!carBrand || !carModel || !regdate || !mileage) {
      return NextResponse.json({ error: "Missing required fields (carBrand, carModel, regdate, mileage)" }, { status: 400 })
    }

    // Find similar cars from database
    const similarCars = await findSimilarCars(carBrand, carModel, regdate)

    if (similarCars.length === 0) {
      return NextResponse.json(
        {
          error: "No similar cars found in database",
          message: `Could not find cars matching ${carBrand} ${carModel} with year around ${regdate}`,
        },
        { status: 404 },
      )
    }

    // Predict price using linear regression
    const prediction = predictCarPrice(
      {
        year: regdate,
        mileage: parseInt(mileage),
        horsepower: horsepowerDin ? parseInt(horsepowerDin) : undefined,
        doors: doors ? parseInt(doors) : undefined,
        seats: seats ? parseInt(seats) : undefined,
      },
      similarCars,
    )

    // Find 10 closest cars for comparison
    const closestCars = findClosestCars(
      {
        year: regdate,
        mileage: parseInt(mileage),
        price: prediction.predictedPrice,
        horsepower: horsepowerDin ? parseInt(horsepowerDin) : undefined,
      },
      similarCars,
      10,
    )

    // Save evaluation to database
    const evaluation = await prisma.evaluation.create({
      data: {
        userId: userId || null,
        carBrand,
        carModel,
        regdate,
        mileage: parseInt(mileage),
        fuelLabel: fuelLabel || null,
        gearboxLabel: gearboxLabel || null,
        vehiculeColor: vehiculeColor || null,
        subject: subject || null,
        locationCountryId: locationCountryId || null,
        locationCity: locationCity || null,
        doors: doors ? parseInt(doors) : null,
        seats: seats ? parseInt(seats) : null,
        horsepowerDin: horsepowerDin ? parseInt(horsepowerDin) : null,
        predictedPrice: prediction.predictedPrice,
        priceRangeMin: prediction.priceRangeMin,
        priceRangeMax: prediction.priceRangeMax,
        confidence: prediction.confidence,
        similarCarsCount: similarCars.length,
        isPaid: false,
      },
    })

    // Format response
    return NextResponse.json({
      evaluationId: evaluation.id,
      car: {
        carBrand,
        carModel,
        regdate,
        mileage,
        fuelLabel,
        gearboxLabel,
        vehiculeColor,
        subject,
        locationCountryId,
        locationCity,
        doors,
        seats,
        horsepowerDin,
      },
      prediction: {
        estimatedPrice: prediction.predictedPrice,
        priceRangeMin: prediction.priceRangeMin,
        priceRangeMax: prediction.priceRangeMax,
        confidence: prediction.confidence,
      },
      similarCars: closestCars.map((car) => ({
        id: car.id,
        carBrand: car.carBrand,
        carModel: car.carModel,
        regdate: car.regdate,
        price: Number(car.price),
        mileage: car.mileage,
        fuelLabel: car.fuelLabel,
        gearboxLabel: car.gearboxLabel,
        vehiculeColor: car.vehiculeColor,
        doors: car.doors,
        seats: car.seats,
        horsepowerDin: car.horsepowerDin,
      })),
      metadata: {
        totalSimilarCars: similarCars.length,
        displayedCars: closestCars.length,
        evaluatedAt: evaluation.createdAt,
      },
    })
  } catch (error) {
    console.error("Evaluation error:", error)
    return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    // Get user's evaluation history
    const evaluations = await prisma.evaluation.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    })

    return NextResponse.json({
      evaluations: evaluations.map((evaluation: any) => ({
        id: evaluation.id,
        carBrand: evaluation.carBrand,
        carModel: evaluation.carModel,
        regdate: evaluation.regdate,
        mileage: evaluation.mileage,
        fuelLabel: evaluation.fuelLabel,
        gearboxLabel: evaluation.gearboxLabel,
        vehiculeColor: evaluation.vehiculeColor,
        subject: evaluation.subject,
        locationCountryId: evaluation.locationCountryId,
        locationCity: evaluation.locationCity,
        doors: evaluation.doors,
        seats: evaluation.seats,
        horsepowerDin: evaluation.horsepowerDin,
        estimatedPrice: Number(evaluation.predictedPrice),
        priceRangeMin: Number(evaluation.priceRangeMin),
        priceRangeMax: Number(evaluation.priceRangeMax),
        confidence: evaluation.confidence,
        similarCarsCount: evaluation.similarCarsCount,
        isPaid: evaluation.isPaid,
        createdAt: evaluation.createdAt,
      })),
    })
  } catch (error) {
    console.error("Get evaluations error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
