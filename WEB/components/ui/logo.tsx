
export function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`relative ${className} group`}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl rotate-0 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-blue-500/20" />
      <div className="absolute inset-0 flex items-center justify-center text-white">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3/5 h-3/5"
        >
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      </div>
    </div>
  )
}
