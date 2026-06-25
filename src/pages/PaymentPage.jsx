import { useEffect, useState, useRef } from 'react'
import { gsap } from 'gsap'
import api from '../lib/api'
import { updateBaseURL } from '../lib/axios'
import { useApiStore } from '../stores/apiStore'
import UserMenu from '../components/UserMenu'
import ScreenLogo from '../components/ScreenLogo'
import { useUserSessionStore } from '../stores/userSessionStore'

const USE_MOCK_PAYMENT_ONLY = false

function PaymentPage({ user, onPaymentSuccess, screenId, serverBase, bmiId }) {
  const { clearUser } = useUserSessionStore()
  const [processing, setProcessing] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(9) // Default amount
  const [loadingAmount, setLoadingAmount] = useState(true)
  const [razorpayKey, setRazorpayKey] = useState(null)
  const [mockMode, setMockMode] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const containerRef = useRef(null)
  const cardRef = useRef(null)
  
  // Fetch Razorpay key and payment amount for this screen
  useEffect(() => {
    const fetchPaymentConfig = async () => {
      if (!serverBase) {
        setLoadingAmount(false)
        return
      }
      
      try {
        // Update server base if needed
        if (serverBase) {
          useApiStore.getState().setServerBase(serverBase)
          updateBaseURL(serverBase)
        }

        // Fetch payment key
        try {
          const keyData = await api.getPaymentKey()
          if (keyData.ok && keyData.key_id) {
            setRazorpayKey(keyData.key_id)
            setMockMode(keyData.mockMode === true)
            if (keyData.mockMode) {
              console.log('[PAYMENT] 🧪 MOCK MODE: Payment system in mock mode')
            } else {
              console.log('[PAYMENT] 💳 LIVE MODE: Razorpay integration active')
            }
          }
        } catch (error) {
          console.error('Error fetching payment key:', error)
          setMockMode(true)
        }

        // Fetch payment amount
        if (screenId) {
          const data = await api.getPlayer(screenId)
          if (data.ok && data.player && data.player.paymentAmount !== null && data.player.paymentAmount !== undefined) {
            setPaymentAmount(data.player.paymentAmount)
          }
        }
      } catch (error) {
        console.error('Error fetching payment config:', error)
      } finally {
        setLoadingAmount(false)
      }
    }
    
    fetchPaymentConfig()
  }, [screenId, serverBase])

  // Background polling for payment status (kept intact for non-mock flow)
  useEffect(() => {
    let pollingInterval
    
    if (bmiId && !mockMode && razorpayKey && !isSuccess && !USE_MOCK_PAYMENT_ONLY) {
      console.log('[PAYMENT] Starting background status polling for bmiId:', bmiId)
      
      pollingInterval = setInterval(async () => {
        try {
          const data = await api.getPaymentStatus(bmiId)
          
          if (data && data.ok && data.paymentStatus === true) {
            console.log('[PAYMENT] ✅ Background poll detected successful payment!')
            if (pollingInterval) clearInterval(pollingInterval)
            handleSuccess()
          }
        } catch (pollError) {
          console.debug('Background poll error (ignoring):', pollError.message)
        }
      }, 5000)
    }
    
    return () => {
      if (pollingInterval) {
        console.log('[PAYMENT] Stopping background status polling')
        clearInterval(pollingInterval)
      }
    }
  }, [bmiId, mockMode, razorpayKey, isSuccess])

  useEffect(() => {
    if (containerRef.current && cardRef.current) {
      gsap.fromTo(containerRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.7)" }
      )
      
      gsap.fromTo(cardRef.current.children,
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.1, delay: 0.3, ease: "power2.out" }
      )
    }
  }, [])

  const handlePayment = async () => {
    if (!serverBase) {
      alert('Payment system not ready. Please try again.')
      return
    }

    setProcessing(true)
    
    try {
      // Animate button
      gsap.to('.payment-btn', {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1
      })

      // Validate payment amount before creating order
      if (!paymentAmount || paymentAmount <= 0 || isNaN(paymentAmount)) {
        alert('Invalid payment amount. Please contact support.')
        setProcessing(false)
        return
      }

      if (USE_MOCK_PAYMENT_ONLY) {
        console.log('[PAYMENT] Mock payment forced from client flag')
        await new Promise(resolve => setTimeout(resolve, 800))
        handleSuccess()
        return
      }

      // Create payment order
      const orderData = await api.createPaymentOrder({
        amount: Number(paymentAmount),
        currency: 'INR',
        receipt: `rcpt${Date.now()}${(user?.userId || 'user').substring(0, 8)}`,
        notes: {
          userId: user?.userId || '',
          screenId: screenId || '',
          bmiId: bmiId || '',
          userName: user?.name || '',
          userMobile: user?.mobile || ''
        }
      })

      if (!orderData.ok || !orderData.order) {
        throw new Error('Invalid order response')
      }

      const orderId = orderData.order.id

      if (mockMode) {
        console.log('[PAYMENT] 🧪 MOCK: Simulating payment process...')
        await new Promise(resolve => setTimeout(resolve, 2000))

        const mockPaymentId = `pay_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        const mockSignature = `sig_mock_${Math.random().toString(36).substring(2, 15)}`

        const verifyData = await api.verifyPayment({
          razorpay_order_id: orderId,
          razorpay_payment_id: mockPaymentId,
          razorpay_signature: mockSignature
        })

        if (verifyData.ok && verifyData.verified) {
          handleSuccess()
        } else {
          throw new Error('Payment verification failed')
        }
      } else {
        if (!window.Razorpay) {
          throw new Error('Razorpay SDK not loaded. Please check your internet connection.')
        }

        const options = {
          key: razorpayKey,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: 'Well2Day',
          description: 'BMI Analysis Payment',
          image: 'https://well2day.in/assets/img/Group%202325.png',
          order_id: orderId,
          handler: async function (response) {
            try {
              console.log('[PAYMENT] Razorpay response received:', response)
              
              const verifyData = await api.verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })

              if (verifyData.ok && verifyData.verified) {
                handleSuccess()
              } else {
                alert('Payment verification failed. Please contact support.')
                setProcessing(false)
              }
            } catch (err) {
              console.error('Verification error:', err)
              alert('Error verifying payment. Please contact support.')
              setProcessing(false)
            }
          },
          prefill: {
            name: user?.name || '',
            contact: user?.mobile || ''
          },
          theme: {
            color: '#059669'
          },
          modal: {
            ondismiss: function() {
              setProcessing(false)
            }
          }
        }

        const rzp = new window.Razorpay(options)
        rzp.on('payment.failed', function (response) {
          console.error('Payment failed:', response.error)
          alert(`Payment failed: ${response.error.description}`)
          setProcessing(false)
        })
        rzp.open()
      }
    } catch (error) {
      console.error('Payment error:', error)
      setProcessing(false)
      alert(error.message || 'Failed to process payment. Please try again.')
    }
  }

  const handleSuccess = () => {
    if (isSuccess) return; // Prevent double trigger
    
    setIsSuccess(true);
    setProcessing(false);
    console.log('[PAYMENT] Payment successful and verified');
    
    // Success animation
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        scale: 1.05,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut",
        onComplete: () => onPaymentSuccess(paymentAmount)
      })
    } else {
      onPaymentSuccess(paymentAmount)
    }
  }

  const handleLogout = () => {
    clearUser()
    window.location.href = '/'
  }

  const handleCheckStatus = async () => {
    if (!bmiId || isSuccess || USE_MOCK_PAYMENT_ONLY) return
    setProcessing(true)
    try {
      const data = await api.getPaymentStatus(bmiId)
      if (data && data.ok && data.paymentStatus === true) {
        handleSuccess()
      } else {
        alert('Payment not detected yet. If you have paid, please wait a few seconds and try again.')
        setProcessing(false)
      }
    } catch (err) {
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary-600 rounded-xl flex items-center justify-center">
                <img 
                  src="https://well2day.in/assets/img/Group%202325.png" 
                  alt="Well2Day Logo" 
                  className="h-8 w-auto"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {user && <UserMenu user={user} onLogout={handleLogout} />}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div ref={containerRef} className="w-full max-w-md">
        <ScreenLogo screenId={screenId} serverBase={serverBase} />
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Secure Payment</h1>
          <p className="text-gray-600">Complete your purchase to access your BMI analysis</p>
        </div>

        <div ref={cardRef} className="space-y-6">
          {(USE_MOCK_PAYMENT_ONLY || mockMode) && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm text-center">
              Test mode is enabled. Clicking the button below will mark the payment as completed.
            </div>
          )}

          {/* User Info Card */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Account Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium text-gray-900">{user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Mobile:</span>
                <span className="font-medium text-gray-900">{user?.mobile}</span>
              </div>
            </div>
          </div>

          {/* Pricing Card */}
          <div className="card border-2 border-primary-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-xl text-gray-900">Well2Day BMI Analysis</h3>
                <p className="text-gray-600 text-sm">Complete health assessment</p>
              </div>
              <div className="text-right">
                {loadingAmount ? (
                  <div className="text-3xl font-bold text-primary-600">...</div>
                ) : (
                  <div className="text-3xl font-bold text-primary-600">₹{paymentAmount}</div>
                )}
              </div>
            </div>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center text-sm text-gray-600">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Detailed BMI calculation & analysis
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Personalized health recommendations
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                AI-powered fortune cookie message
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={processing}
              className={`payment-btn w-full ${processing ? 'bg-gray-400 cursor-not-allowed' : 'btn-primary'}`}
            >
              {processing ? (
                <div className="flex items-center justify-center">
                  <div className="loading-spinner w-5 h-5 mr-2"></div>
                  {USE_MOCK_PAYMENT_ONLY ? 'Completing Payment...' : 'Processing Payment...'}
                </div>
              ) : (
                USE_MOCK_PAYMENT_ONLY
                  ? `Complete Mock Payment - ₹${paymentAmount}`
                  : `Pay ₹${paymentAmount} - Secure Payment`
              )}
            </button>

            {!mockMode && !isSuccess && !USE_MOCK_PAYMENT_ONLY && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleCheckStatus}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 underline focus:outline-none"
                >
                  Already paid? Click here to refresh status
                </button>
              </div>
            )}
          </div>

          {/* Security Badge */}
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Secured by 256-bit SSL encryption</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
export default PaymentPage
