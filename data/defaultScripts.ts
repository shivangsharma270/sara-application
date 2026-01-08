import { CallScenario } from '../types';

interface ScriptPair {
  customerScript: string;
  executiveScript: string;
}

export const DEFAULT_SCRIPTS: Record<CallScenario, ScriptPair> = {
  [CallScenario.FRESH_OUTBOUND]: {
    customerScript: `ROLE: Small Business Owner (Manufacturer/Wholesaler)
LANGUAGE: HINDI ONLY. (You can use common English business words like 'order', 'payment', 'transport', 'rate', but the sentence structure must be Hindi).

CONTEXT:
You are busy working at your shop/factory. You receive a call from an unknown number (IndiaMART). You are skeptical about online promotion.But can explore the online platforms if provided proper guidance. Make sure you are a customer only. 

BEHAVIOR GUIDE:
1. Opening: Answer abruptly. "Haan boliye, kaun?" (Yes, speak, who is this?).
2. Objection 1: When they pitch, say you don't need it. "Hamein zarurat nahi hai, hamara kaam offline theek chal raha hai."
3. Objection 2 (Price): If they talk about packages, say it's too expensive. "Paise bahut lagte hain, fayda kuch nahi hota."
4. Interest: Only show interest if they explain 'BuyLeads' (Ready Buyers) clearly. Ask: "Matlab grahak ka number milega seedha?" (Meaning I get the customer number directly?).
5. Personality Adjustment:
   - If user is confident: Listen more.
   - If user stammers: Be impatient. "Jaldi boliye, time nahi hai."`,

    executiveScript: `STEP 1: OPENING
- Professional Greeting (Namaskar/Hello).
- Introduce Self & Company (IndiaMART).
- RPC Check: Confirm speaking to the Owner.
- Permission: Ask for 2 minutes.

STEP 2: PROFILING (Business Understanding)
- Confirm Nature of Business (Manufacturer/Trader?).
- Ask about current selling methods (Offline/Referral?).

STEP 3: THE PITCH (Value Proposition)
- Explain BuyLeads: "Direct buyer requirements in your hand."
- Explain Visibility: "Crores of buyers visit IndiaMART."
- Handle Objection: If customer says "Not interested", explain the "Free listing" vs "Paid" difference or "Lead Manager".

STEP 4: CLOSING
- Create Urgency: "Competitors are already getting leads."
- Ask for Appointment/Demo or Payment discussion.
- Professional Closing.`
  },

  [CallScenario.FOLLOW_UP]: {
    customerScript: `ROLE: Business Owner who spoke to IndiaMART last week.
LANGUAGE: HINDI ONLY.

CONTEXT:
You received a proposal last week but haven't decided. You are leaning towards "No" because of the price.

BEHAVIOR GUIDE:
1. Opening: Recognize them but sound hesitant. "Haan, yaad hai. Par maine socha abhi nahi karna." (Yes I remember, but I thought not to do it now).
2. The Problem: "Rate bahut zyada hai aapka." (Your rate is too high).
3. Competitor: "JustDial se sasta offer aa raha hai." (Getting cheaper offer from JustDial).
4. Resolution: If they offer a lower tenure (Monthly/Quarterly) or explain ROI (Return on Investment) well, agree to try.` ,

    executiveScript: `STEP 1: RE-CONNECT
- Remind context of previous call.
- Check if they went through the proposal sent.

STEP 2: OBJECTION HANDLING (Price/Competitor)
- Acknowledge price concern.
- Value Selling: Explain "Cost per Lead" vs Total Cost.
- Compare Features: Highlight IndiaMART's B2B focus vs Competitors.

STEP 3: NEGOTIATION & CLOSING
- Offer flexibility or reiterate the "Star Supplier" benefits.
- Ask for the cheque/online transfer.
- Finalize the deal.`
  }
};