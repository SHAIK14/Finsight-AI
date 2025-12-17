from typing import Dict
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.agents.state import AgentState
from app.core.config import get_settings

settings = get_settings()

llm = ChatOpenAI(
    model="gpt-4o-mini",
    openai_api_key=settings.openai_api_key,
    temperature=0
)

def synthesis_agent(state:AgentState) -> AgentState:
    research_output = state.get("research_output","")   
    verification_output = state.get("verification_output","")
    risk_output = state.get("risk_output","")
    context_parts = []
    if research_output:
        context_parts.append(f"### Research Findings:\n{research_output}")
    if verification_output:
        context_parts.append(f"### Verification Results:\n{verification_output}")
    if risk_output:
        context_parts.append(f"### Risk Analysis:\n{risk_output}")
    
    combined_context = "\n\n".join(context_parts)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert financial analyst creating comprehensive, well-structured reports.

Your job: Synthesize agent outputs into professional financial analysis.

You receive:
- Research findings (facts from documents/web)
- Verification results (cross-checks, if run)
- Risk analysis (risk assessment, if run)

OUTPUT REQUIREMENTS:

1. **Structure & Formatting:**
   - Start with a clear title using ## or ###
   - Use markdown tables for numerical/comparative data
   - Use bullet points for lists
   - Use **bold** for key numbers and metrics
   - Use proper spacing and sections

2. **When to Use Tables:**
   - Financial metrics (revenue, profit, expenses)
   - Quarterly/yearly comparisons
   - Multiple data points for same entity
   - Any data with 3+ rows/columns

   Example table format:
   | Metric | Value | Change |
   |--------|-------|--------|
   | Revenue | ₹718.04 Cr | +15.2% YoY |
   | Profit | ₹186.02 Cr | +22.5% YoY |

3. **Content Quality:**
   - Extract ALL relevant numbers from agent outputs
   - Include specific dates, quarters, fiscal years
   - Always cite sources (Page X from docs, URL for web)
   - Add context: YoY changes, comparisons, trends
   - Include key highlights section for important findings

4. **Comprehensive Coverage:**
   - Don't summarize too much - include detailed figures
   - If agents found 10 metrics, show all 10 (in table format)
   - Add "Key Takeaways" or "Summary" section at the end
   - Include forward-looking insights when available

5. **Citation Format:**
   - Documents: (Page X) or (Pages 4, 8, 11)
   - Web: Include actual website name and URL like (Source: [Moneycontrol](url))
   - NEVER use "Source 1", "Source 2" - always use real website names
   - For stock prices: cite ONE reliable source (NSE, BSE, Moneycontrol preferred)

Don't just repeat what agents said - synthesize, structure, and enhance it into a professional financial report."""),
        ("user", """Question: {question}

Agent Outputs:
{context}

Create final answer:""")
    ])
    
    chain = prompt | llm
    
    try:
        response = chain.invoke({
            "question": state["question"],
            "context": combined_context
        })
        final_answer = response.content
    except Exception as e:
        final_answer = f"Synthesis failed: {str(e)}"
    
    state["final_answer"] = final_answer
    state["next_agent"] = "END"
    
    return state

    