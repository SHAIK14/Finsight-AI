from typing import List, Dict
from langchain_core.tools import tool
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

@tool
def risk_search_tool(chunks: List[Dict]) -> str:
    """Find and extract risk-related content from chunks."""
    if not chunks:
        return "No chunks available for risk analysis"
    
    risk_keywords = ["risk", "uncertainty", "loss", "litigation", "compliance", "regulatory", "market conditions", "competition"]
    
    risk_related_chunks = []
    for i, chunk in enumerate(chunks):
        content_lower = chunk["content"].lower()
        if any(keyword in content_lower for keyword in risk_keywords):
            chunk_text = (
                f"[Risk Chunk {i+1}] (Page {chunk['page_number']})\n"
                f"{chunk['content']}\n"
            )
            risk_related_chunks.append(chunk_text)
    
    if not risk_related_chunks:
        return "No risk-related content found in chunks"
    
    return "\n".join(risk_related_chunks)

def risk_agent(state: AgentState) -> AgentState:
    research_output = state.get("research_output", "")
    
    if not research_output:
        state["risk_output"] = "No research findings to analyze for risks"
        state["next_agent"] = "synthesis"
        return state
    
    tools = [risk_search_tool]
    llm_with_tools = llm.bind_tools(tools)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a risk analysis agent for financial documents.

Your job: Identify and assess risks mentioned in the research findings and documents.

Available tools:
1. risk_search_tool: Find risk-related sections in source chunks

Analyze:
- What risks are mentioned?
- How severe are they?
- Are they quantified?
- Any mitigation strategies mentioned?

Output format:
🔴 High severity risks
🟡 Medium severity risks
🟢 Low severity risks

Include page references and specifics."""),
        ("user", """Research findings:
{research_output}

Analyze risks:""")
    ])
    
    chain = prompt | llm_with_tools
    
    try:
        response = chain.invoke({
            "research_output": research_output
        })
        risk_findings = response.content
    except Exception as e:
        risk_findings = f"Risk analysis failed: {str(e)}"
    
    state["risk_output"] = risk_findings
    state["next_agent"] = "synthesis"
    
    return state