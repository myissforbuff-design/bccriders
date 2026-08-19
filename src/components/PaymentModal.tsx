import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { store } from '../lib/db';
import { OfficialLoader } from './OfficialLoader';
import {
  CreditCard,
  Lock,
  CheckCircle2,
  X,
  Receipt,
  Download,
  Wallet,
  Building,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  amount: number;
  type: 'Event Registration' | 'Club Gear';
  description: string;
  eventId?: string;
  onSuccess?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  title,
  amount,
  type,
  description,
  eventId,
  onSuccess,
}) => {
  const { currentUser, refreshUserData } = useAuth();
  useModalDismiss(isOpen, onClose);
  const [method, setMethod] = useState<'Credit Card' | 'Apple Pay' | 'Bank Transfer' | 'Club Wallet'>('Credit Card');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  // Card Inputs
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 8810');
  const [cardExp, setCardExp] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('910');
  const [cardName, setCardName] = useState(currentUser?.name || 'Marcus Vance');

  if (!isOpen) return null;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);

    setTimeout(() => {
      let payResult;
      if (type === 'Event Registration' && eventId) {
        const { payment } = store.registerForEvent(eventId, currentUser.id, amount, method);
        payResult = payment;
      } else {
        payResult = store.addPayment({
          userId: currentUser.id,
          userName: currentUser.name,
          amount,
          createdAt: new Date().toISOString(),
          status: 'Paid',
          type,
          paymentMethod: method,
          description: title || 'Club Payment',
        });
      }

      refreshUserData();
      setLoading(false);
      setReceipt(payResult);
      if (onSuccess) onSuccess();
    }, 1200);
  };

  const resetModal = () => {
    setReceipt(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg rounded-3xl bg-white border border-[#e2ece2] shadow-2xl overflow-hidden my-8 text-[#2d3a3a]"
        >
          {/* Modal Header */}
          <div className="p-6 bg-[#f7f9f7] border-b border-[#e2ece2] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#d8f3dc] text-[#1b4332]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-[#1b4332] text-lg">
                  {receipt ? 'Payment Receipt' : title}
                </h3>
                <p className="text-xs text-[#52605d]">
                  {receipt ? 'Transaction Completed Successfully' : 'BCC Secure Club Checkout'}
                </p>
              </div>
            </div>
            <button
              onClick={resetModal}
              className="p-2 text-[#52605d] hover:text-[#1b4332] rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {receipt ? (
            /* Success Receipt View */
            <div className="p-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-4 rounded-full bg-[#d8f3dc] text-[#1b4332]">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="font-heading text-xl font-extrabold text-[#1b4332]">
                  Payment Confirmed!
                </h4>
                <p className="text-xs text-[#52605d] max-w-xs mx-auto">
                  Your payment has been logged in the BCC ERP ledger. A digital copy is available below.
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3 font-mono text-xs">
                <div className="flex justify-between text-[#52605d] pb-2 border-b border-[#e2ece2]">
                  <span>REF NO:</span>
                  <span className="text-[#2d6a4f] font-bold">{receipt?.transactionRef || 'BCC-TXN-10293'}</span>
                </div>
                <div className="flex justify-between text-[#2d3a3a]">
                  <span>Payer Name:</span>
                  <span className="font-sans font-semibold text-[#1b4332]">{receipt?.userName || currentUser?.name}</span>
                </div>
                <div className="flex justify-between text-[#2d3a3a]">
                  <span>Payment Type:</span>
                  <span className="font-sans font-semibold text-[#2d6a4f]">{type}</span>
                </div>
                <div className="flex justify-between text-[#2d3a3a]">
                  <span>Method:</span>
                  <span className="font-sans text-[#2d3a3a]">{receipt?.paymentMethod || method}</span>
                </div>
                <div className="flex justify-between text-[#2d3a3a]">
                  <span>Date & Time:</span>
                  <span className="text-[#52605d]">{receipt?.createdAt || new Date().toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-[#e2ece2] flex justify-between items-center text-sm font-sans font-bold">
                  <span className="text-[#1b4332]">Total Amount Paid:</span>
                  <span className="text-[#2d6a4f] text-lg">₱{amount.toLocaleString()}.00 PHP</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 px-4 rounded-xl bg-white hover:bg-gray-50 text-[#1b4332] font-semibold text-xs flex items-center justify-center gap-2 border border-[#e2ece2] transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Print / Save Receipt
                </button>
                <button
                  onClick={resetModal}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs transition-colors cursor-pointer text-center"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Payment Form */
            <form onSubmit={handlePay} className="p-6 space-y-6">
              {/* Order Item Overview */}
              <div className="p-4 rounded-2xl bg-[#d8f3dc]/60 border border-[#b7e4c7] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#1b4332] uppercase tracking-wider">
                    Item Description
                  </span>
                  <h4 className="font-heading font-semibold text-[#1b4332] text-sm mt-0.5">
                    {description}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#52605d]">Total Due</span>
                  <p className="font-heading text-xl font-extrabold text-[#1b4332]">
                    ₱{amount.toLocaleString()}.00
                  </p>
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div>
                <label className="text-xs font-semibold text-[#2d3a3a] mb-2 block">
                  Select Payment Gateway
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'Credit Card', icon: CreditCard, label: 'Card' },
                    { id: 'Apple Pay', icon: Smartphone, label: 'Apple Pay' },
                    { id: 'Bank Transfer', icon: Building, label: 'ACH Bank' },
                    { id: 'Club Wallet', icon: Wallet, label: 'BCC Wallet' },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = method === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id as any)}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1b4332] text-white border-[#1b4332] shadow-xs'
                            : 'bg-white text-[#52605d] border-[#e2ece2] hover:bg-gray-50 hover:text-[#1b4332]'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Method Details Input */}
              {method === 'Credit Card' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-semibold text-[#52605d] mb-1 block">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#52605d] mb-1 block">
                      Card Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f] pr-10"
                      />
                      <CreditCard className="w-4 h-4 text-[#52605d] absolute right-3 top-3" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#52605d] mb-1 block">
                        Expires (MM/YY)
                      </label>
                      <input
                        type="text"
                        value={cardExp}
                        onChange={(e) => setCardExp(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#52605d] mb-1 block">
                        Security CVC
                      </label>
                      <input
                        type="password"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        required
                        maxLength={4}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {method === 'Apple Pay' && (
                <div className="p-6 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] text-center space-y-3">
                  <Smartphone className="w-10 h-10 text-[#2d6a4f] mx-auto" />
                  <p className="text-xs text-[#52605d]">
                    Double-click side button or confirm Touch ID / Face ID to complete payment of <strong className="text-[#1b4332]">₱{amount.toLocaleString()}.00</strong>.
                  </p>
                </div>
              )}

              {method === 'Bank Transfer' && (
                <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] text-xs space-y-2 font-mono">
                  <p className="text-[#52605d]">BCC Club Treasury Routing:</p>
                  <p className="text-[#2d6a4f] font-bold">ROUTING: 122000218 | ACCT: 884029104</p>
                  <p className="text-[11px] text-[#52605d] font-sans">
                    Instant verification active for registered members.
                  </p>
                </div>
              )}

              {method === 'Club Wallet' && (
                <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[#52605d]">Club Balance:</span>
                    <p className="text-[#2d6a4f] font-bold text-sm">₱5,000.00 Available</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#d8f3dc] text-[#1b4332] font-semibold">
                    Pre-funded
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-[#ffffff] font-extrabold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Pay ₱{amount.toLocaleString()}.00 Now</span>
              </button>

              <p className="text-[10px] text-center text-[#52605d] flex items-center justify-center gap-1">
                <Lock className="w-3 h-3 text-[#2d6a4f]" />
                256-Bit Encrypted Secure Payment Gateway
              </p>
            </form>
          )}
        </motion.div>
        <OfficialLoader isLoading={loading} message="Processing Secure Payment..." />
      </div>
    </AnimatePresence>
  );
};
