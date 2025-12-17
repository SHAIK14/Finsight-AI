from typing import List, Dict
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

def extract_risk_content(chunks: List[Dict]) -> str:
    if not chunks:
        return "No documents available"
    
    risk_keywords = ["risk", "uncertainty", "loss", "litigation", "compliance", 
                     "regulatory", "market conditions", "competition", "threat",
                     "challenge", "volatility", "exposure", "liability"]
    
    risk_chunks = []
    for chunk in chunks:
        content_lower = chunk.get("content", "").lower()
        if any(keyword in content_lower for keyword in risk_keywords):
            page = chunk.get('page_number', 'N/A')
            content = chunk.get('content', '')[:400]
            risk_chunks.append(f"[Page {page}]\n{content}")
    
    if not risk_chunks:
        return "No explicit risk sections found in documents"
    
    return "\n---\n".join(risk_chunks[:5])

def risk_agent(state: AgentState) -> AgentState:
    research_output = state.get("research_output", "")
    chunks = state.get("chunks", [])
    
    if not research_output:
        state["risk_output"] = "No research findings to analyze"
        state["next_agent"] = "synthesis"
        return state
    
    risk_content = extract_risk_content(chunks)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a financial risk analyst. Identify risks from the research and documents.

Categorize risks by severity:
🔴 HIGH: Material risks that could significantly impact financials
🟡 MEDIUM: Notable risks requiring monitoring
🟢 LOW: Minor risks with limited impact

For each risk:
- State what the risk is
- Why it matters (potential impact)
- Page reference if from document

Be concise. Max 3-5 key risks."""),
        ("user", """Research findings:
{research_output}

Risk-related document sections:
{risk_content}

Analyze risks:""")
    ])
    
    chain = prompt | llm
    
    try:
        response = chain.invoke({
            "research_output": research_output,
            "risk_content": risk_content
        })
        risk_findings = response.content
    except Exception as e:
        risk_findings = f"Risk analysis failed: {str(e)}"
    
    state["risk_output"] = risk_findings
    state["next_agent"] = "synthesis"
    
    return state