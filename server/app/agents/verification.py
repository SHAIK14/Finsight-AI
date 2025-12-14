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
def cross_reference_tool(chunks: List[Dict], research_findings: str) -> str:
    """Cross-reference research findings against source chunks."""
    if not chunks:
        return "No chunks to cross-reference"
    
    formatted_chunks = []
    for i, chunk in enumerate(chunks):
        chunk_text = (
            f"[Chunk {i+1}] (Page {chunk['page_number']})\n"
            f"{chunk['content']}\n"
        )
        formatted_chunks.append(chunk_text)
    
    return f"Research Claims:\n{research_findings}\n\nSource Chunks:\n" + "\n".join(formatted_chunks)

def verification_agent(state: AgentState) -> AgentState:
    research_output = state.get("research_output", "")
    
    if not research_output:
        state["verification_output"] = "No research findings to verify"
        state["next_agent"] = "synthesis"
        return state
    
    tools = [cross_reference_tool]
    llm_with_tools = llm.bind_tools(tools)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a verification agent that checks research findings for accuracy.

Your job: Cross-reference research claims against source chunks.

Available tools:
1. cross_reference_tool: Compare research findings to actual source chunks

Verify:
- Are page numbers correct?
- Are quotes/numbers accurate?
- Are claims supported by sources?
- Any contradictions?

Output format:
- ✅ Verified claims
- ⚠️ Uncertain claims (need more info)
- ❌ Incorrect claims (with corrections)

Be strict but fair."""),
        ("user", """Research findings to verify:
{research_output}

Verify these claims:""")
    ])
    
    chain = prompt | llm_with_tools
    
    try:
        response = chain.invoke({
            "research_output": research_output
        })
        verification_findings = response.content
    except Exception as e:
        verification_findings = f"Verification failed: {str(e)}"
    
    state["verification_output"] = verification_findings
    
    agents_needed = state["route_info"].get("agents_needed", [])
    if "risk" in agents_needed:
        next_agent = "risk"
    else:
        next_agent = "synthesis"
    
    state["next_agent"] = next_agent
    return state