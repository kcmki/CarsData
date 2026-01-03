"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "@/lib/i18n"

export function HeroIllustration() {
  const { t } = useTranslation()
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate position relative to center of screen (-1 to 1)
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = (e.clientY / window.innerHeight) * 2 - 1
      setMousePosition({ x, y })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  // Parallax factors
  const carFactor = 30
  const dataFactor = 60 // Moves more = closer
  const bgFactor = -20

  // 3D Rotation
  const rotateX = mousePosition.y * -15 // Tilt up/down (inverted for natural feel)
  const rotateY = mousePosition.x * 15  // Turn left/right

  return (
    <div className="relative w-full h-full min-h-[300px] flex items-center justify-center [perspective:1000px] group">
      {/* Abstract Background Blobs - Moving slightly opposite for depth */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse transition-transform duration-100 ease-out -z-10"
        style={{
            transform: `translate(calc(-50% + ${mousePosition.x * bgFactor}px), calc(-50% + ${mousePosition.y * bgFactor}px))`
        }}
      />
      
      <div
         className="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
         style={{
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            transformStyle: 'preserve-3d'
         }}
      >
        <svg viewBox="0 0 800 600" className="w-full h-full drop-shadow-2xl overflow-visible" xmlns="http://www.w3.org/2000/svg">
            <defs>
            <linearGradient id="carGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            </defs>
            
            {/* Car Group with Parallax */}
            <g 
                style={{ 
                    transform: `translate(${mousePosition.x * carFactor}px, ${mousePosition.y * carFactor}px)`,
                    transition: 'transform 0.1s ease-out'
                }}
            >
                {/* Floating Animation Wrapper */}
                <g style={{ animation: 'float 6s ease-in-out infinite' }}>
                    {/* Stylized Car Body */}
                    <path 
                        d="M150,350 L200,250 L350,220 L550,220 L650,280 L680,350 L680,400 L150,400 Z" 
                        fill="url(#carGradient)" 
                        opacity="0.9"
                        className="transition-all duration-500"
                    />
                    {/* Windows */}
                    <path d="M220,260 L340,240 L530,240 L620,290 L220,290 Z" fill="white" opacity="0.3" />
                    
                    {/* Wheels */}
                    <circle cx="230" cy="400" r="45" fill="#1e293b" stroke="url(#carGradient)" strokeWidth="4" />
                    <circle cx="230" cy="400" r="20" fill="#334155" />
                    
                    <circle cx="600" cy="400" r="45" fill="#1e293b" stroke="url(#carGradient)" strokeWidth="4" />
                    <circle cx="600" cy="400" r="20" fill="#334155" />
                    
                    {/* Speed Lines - Moving faster for effect */}
                    <g style={{ transform: `translateX(${mousePosition.x * -10}px)` }}>
                        <rect x="50" y="250" width="60" height="4" rx="2" fill="#cbd5e1" opacity="0.5" style={{ animation: 'slide 2s infinite linear' }} />
                        <rect x="20" y="300" width="100" height="4" rx="2" fill="#cbd5e1" opacity="0.5" style={{ animation: 'slide 2.5s infinite linear' }} />
                        <rect x="80" y="380" width="40" height="4" rx="2" fill="#cbd5e1" opacity="0.5" style={{ animation: 'slide 3s infinite linear' }} />
                    </g>

                    {/* Valuation Card & Line - Integrated into Car Group for perfect sync */}
                    <g>
                        <line x1="350" y1="220" x2="450" y2="150" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />
                        
                        {/* Valuation Card */}
                        <g 
                            className="cursor-pointer hover:scale-110 transition-transform duration-300"
                            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                        >
                            <rect x="440" y="120" width="140" height="50" rx="8" fill="white" className="dark:fill-slate-800" filter="url(#glow)" />
                            <text x="510" y="150" textAnchor="middle" fill="#3b82f6" fontSize="16" fontWeight="bold" fontFamily="sans-serif">{t("hero.valuation.goodPrice")}</text>
                        </g>
                    </g>
                </g>
            </g>
        </svg>
      </div>
    </div>
  )
}
