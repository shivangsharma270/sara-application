
import { GoogleGenAI, Type } from "@google/genai";
import { EvaluationResult, CallConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const INDIAMART_KNOWLEDGE_BASE = `
--- INDIAMART OFFICIAL ANSWER KEY (SOURCE OF TRUTH) ---

1. OBJECTION: "Mujhe plan nahi chahiye / I don't need a plan."
   CORRECT ANSWER: "Sir, I am not calling for a plan. I am just explaining the enquiry process. Enquiries are based on your product photos/details. I am guiding you on how to check relevant enquiries."

2. OBJECTION: "Enquiry useful nahi hoti / Enquiries are useless."
   CORRECT ANSWER: "Relevant enquiries only come if product mapping is correct. Go to Seller Tools -> Manage Products to fix details for accurate enquiries."

3. GUIDANCE: "Seller Tools ka option nahi dikh raha / Can't see Seller Tools."
   CORRECT ANSWER: "Open App -> Click Top Left 3 Lines -> Look for Red Color 'Seller Tools'. Click to open dashboard."

4. CONFUSION: "Product sizes (100ml, 200ml) showing separately?"
   CORRECT ANSWER: "If you deal in multiple sizes, add size variations in the listing. Correct details give buyers exact info and bring relevant enquiries."

5. ISSUE: "Getting irrelevant enquiries (GoPro/Mouse instead of my product)."
   CORRECT ANSWER: "Use 'Search BuyLead' to search your specific product (e.g., Herbal) and Shortlist them. Star marking filters out irrelevant enquiries."

6. QUESTION: "BuyLead shortlisting ka kya fayda hai? / Benefit of shortlisting?"
   CORRECT ANSWER: "Shortlisting teaches the IndiaMART algorithm what products you deal in. If you shortlist 6-7 leads, you start getting relevant enquiries."

7. QUESTION: "Is Nakshatra my brand or product?"
   CORRECT ANSWER: "Nakshatra is the product name. Your brand is NRP Ayurveda. We will align listing brand/product names for clarity."

8. QUESTION: "I only use Mobile App, not Laptop."
   CORRECT ANSWER: "No issue. Product mapping, checking enquiries, shortlisting BuyLeads - everything can be done on the Mobile App."

9. QUESTION: "BuyLead verify kaise hota hai? / How is it verified?"
   CORRECT ANSWER: "IndiaMART checks Buyer's GST, Purchase History, Requirement, and Phone Verification. Only 100% genuine buyers generate BuyLeads."

10. QUESTION: "Order Value 14k-16k meaning?"
    CORRECT ANSWER: "It means the buyer wants to buy 50kg quantity within a budget of 14k-16k. This is approximate budgeting."

11. WEBSITE LINK: "seller.indiamart.com/sell" (Just add /sell after indiamart.com).
    WHATSAPP LINK: Executive should offer to send a clickable link on WhatsApp if typing is hard.

12. FEAR: "Login se kuch ulta pulta to nahi hoga? / Payment deduct?"
    CORRECT ANSWER: "Login is just for viewing. No payment/deduction happens without your permission."

13. SLIDE: "How Do You IndiaMART page?" -> It's an intro page showing IndiaMART appears top on Google search.
    SLIDE: "Growth Slide?" -> Shows internet user growth 2018-2025. Proves market demand.
    SLIDE: "What is IndiaMART?" -> 27-year old marketplace, 17 crore buyers, 2 lakh paid suppliers.

14. OFFERINGS:
    - High Listing: Top position on Google/IndiaMART.
    - 4-Page Catalog: Professional website with 400 products, prices, images. Builds trust (3x conversion).
    - Buy Leads: Verified buyer requirements (Weekly 10 + Daily 1 Bonus = 70/month).
    - Verified Lead: Phone, GST, Requirement checked.
    - Free vs Paid Enquiry: Free = Buyer just visits profile (low intent). Paid = Verified bulk requirement.
    - PNS (Preferred Number Service): Virtual number merging all business lines. Call recording/tracking.
    - Lead Manager: Like WhatsApp for business. Quotations, Reminders, Follow-ups.
    - Payment Gateway: Safe advance payment. 0% Commission (100% to seller). Fraud chance zero.

15. COMPETITORS:
    - 132/211 Numbers: Local vs Pan-India suppliers. Shows market size.
    - Why show competitors?: To compare and see how much business/enquiries they are getting.
    - "Left Behind": You are not left behind, just late decision. Activate now to catch up.

16. MAPPING:
    - Definition: Matching real products to buyer demand.
    - Quantity: Recommend 5-7 mappings per category.
    - Star Button: Used to shortlist/map.

17. PAYMENT:
    - Funds Stuck: "Complete mapping now, pay when comfortable. Don't stop growth."
    - EMI: Available on Credit Cards.
    - No Credit Card?: Use relative's card.

18. PACKAGES:
    - MDC (Mini Dynamic Catalog): Annual Plan ~ Rs 28,000 + GST.
    - Monthly vs Annual: Monthly = 7 leads/week. Annual = 10 leads/week + Discount.
    - GST Input: Seller can claim Rs 5040 GST back.
`;

export const generateEvaluation = async (
  transcript: string,
  config: CallConfig,
  durationSeconds: number
): Promise<EvaluationResult> => {

  const isShortCall = durationSeconds < 120; // less than 2 minutes

  const prompt = `
    You are a Strict Quality Auditor for IndiaMART. You just listened to a mock call.
    Your job is to fill out the "Call Audit Parameter Score" sheet exactly as per the format below.
    
    Context:
    - Executive: ${config.executiveName}
    - Scenario: ${config.scenario}
    - Customer Persona: ${config.selectedSeller.name} (${config.selectedSeller.businessType})
    
    ${INDIAMART_KNOWLEDGE_BASE}

    Transcript:
    ${transcript}
    
    --- AUDIT INSTRUCTIONS ---
    Evaluate each parameter on a scale of 0 to 10 (10 = Perfect, 5 = Partial, 0 = Missed).
    
    Category 1: Intro - opening statement
    - Proper call opening with brand & self intro
    - Company name with RPC(Right Party Contact) confirmation

    Category 2: Business Understanding - Sellers business area, product
    - Products confirmation (Did they ask what products the seller deals in?)
    - Business radius confirmed (Where do they supply?)
    - Set Context of Indiamart - What Indiamart is, How many users
    - Internet is changing the world, Internet user count

    Category 3: MDC Pitch - Product details
    - Higher listing & All India promotion informed
    - What is BL (BuyLeads) - Informed
    - What is Business Enquiry - Informed
    - How the seller receive Business Enquires & BL ( How to use them )
    - Discussion related to available BL
    - Difference B/W Business Enquiry & BL - Informed
    - How do you make money by onboarding on IndiaMART - Cost Benefit analysis
    - Read a few competitors With enquiry count - URGENCY

    Category 4: MDC Pitch - Features
    - BAH - BL weekly count informed
    - BAH - Lead Manager & it's feature explained
    - BAH - PNS informed
    - Simultaneously BAH PPT was checked by the client while demo (Did executive ask client to look at screen/PPT?)

    Category 5: Hygiene
    - Comparison B/W annual & monthly informed

    Category 6: Enrichment
    - Enrichment (Any addition done in products or profile?)

    Category 7: Closure
    - Urgency creation observed Through out the call
    - If Sale not closed, how to follow up. Next meeting set, As about Free Slot

    Category 8: Others
    - Fatal Points Observed( Unrealistic Commitments) (Score 10 if NONE observed, 0 if fatal error made)
    - Two way communication observed
    - Rebuttal and Concerns handling
    - Asked the client to come online

    --- SENTIMENT & QUALITY CHECK ---
    Analyze the EXECUTIVE'S tone:
    - Score (0-100)
    - Label (e.g., "Professional", "Rude", "Robotic")
    - Analysis
    
    Produce JSON.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.INTEGER, description: "Total Score out of 100 based on weighted average of audit" },
          auditReport: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                totalScore: { type: Type.INTEGER },
                maxTotalScore: { type: Type.INTEGER },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      parameter: { type: Type.STRING },
                      score: { type: Type.INTEGER },
                      maxScore: { type: Type.INTEGER },
                      remarks: { type: Type.STRING }
                    },
                    required: ["parameter", "score", "maxScore", "remarks"]
                  }
                }
              },
              required: ["category", "totalScore", "maxTotalScore", "items"]
            }
          },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING },
          meetingFixed: { type: Type.BOOLEAN },
          meetingTime: { type: Type.STRING },
          sentiment: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER },
              label: { type: Type.STRING },
              analysis: { type: Type.STRING }
            },
            required: ["score", "label", "analysis"]
          }
        },
        required: ["overallScore", "auditReport", "strengths", "improvements", "actionPoints", "summary", "meetingFixed", "sentiment"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No evaluation generated");
  const result = JSON.parse(text) as EvaluationResult;
  result.isShortCall = isShortCall;
  return result;
};
