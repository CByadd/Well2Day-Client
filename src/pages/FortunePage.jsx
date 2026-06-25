import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import QRCode from 'qrcode'

function FortunePage({ message, data, onNavigate }) {
  const containerRef = useRef(null)
  const cookieRef = useRef(null)
  const messageRef = useRef(null)
  const [qrCodeUrl, setQrCodeUrl] = useState('')

  // Generate QR code
  useEffect(() => {
    if (data?.webUrl) {
      QRCode.toDataURL(data.webUrl, { width: 200, margin: 2 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('QR Code generation failed:', err))
    }
  }, [data])

  // Auto-redirect to dashboard after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onNavigate) {
        onNavigate('dashboard')
      }
    }, 10000)

    return () => clearTimeout(timer)
  }, [onNavigate])

  useEffect(() => {
    if (containerRef.current && cookieRef.current && messageRef.current) {
      // Container fade in
      gsap.fromTo(containerRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }
      )
      
      // Cookie bounce animation
      gsap.fromTo(cookieRef.current,
        { scale: 0, rotation: -180 },
        { 
          scale: 1, 
          rotation: 0, 
          duration: 1,
          delay: 0.3,
          ease: "back.out(1.7)" 
        }
      )
      
      // Message typewriter effect
      gsap.fromTo(messageRef.current,
        { opacity: 0, y: 20 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.8,
          delay: 1,
          ease: "power2.out" 
        }
      )
      
      // Floating animation for cookie
      gsap.to(cookieRef.current, {
        y: -10,
        duration: 3,
        yoyo: true,
        repeat: -1,
        ease: "power2.inOut",
        delay: 1.5
      })
    }
  }, [])

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div ref={containerRef} className="w-full max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div ref={cookieRef} className="text-8xl mb-6">🥠</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Your Fortune Cookie</h1>
          <p className="text-lg text-gray-600">A personalized message for your health journey</p>
        </div>

        <div className="card border-2 border-accent-200 bg-gradient-to-br from-accent-50 to-primary-50 mb-8">
          <div className="relative">
            {/* Decorative quotes */}
            <div className="absolute -top-2 -left-2 text-4xl text-accent-300">"</div>
            <div className="absolute -bottom-6 -right-2 text-4xl text-accent-300">"</div>
            
            <div ref={messageRef} className="px-8 py-4">
              <p className="text-xl leading-relaxed text-gray-800 font-medium">
                {message || "Your health journey is just beginning! Every step forward is progress worth celebrating."}
              </p>
            </div>
          </div>

        </div>

        {/* QR Code Section */}
        {qrCodeUrl && (
          <div className="card border-2 border-primary-200 bg-white mb-8">
            <div className="p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Scan to continue on mobile</h3>
              <div className="flex justify-center">
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code" 
                  className="w-48 h-48 border-2 border-gray-200 rounded-lg"
                />
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Use your mobile device to scan this QR code
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-2 text-primary-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Thank you for choosing Well2Day</span>
          </div>
          
          <p className="text-sm text-gray-500">
            Redirecting to your dashboard in 10 seconds...
          </p>
          
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
        </div>
      </div>
    </div>
  )
}
export default FortunePage
