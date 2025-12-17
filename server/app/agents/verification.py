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

def format_chunks_for_verification(chunks: List[Dict]) -> str:
    if not chunks:
        return "No source chunks available"
    
    formatted = []
    for i, chunk in enumerate(chunks[:8]):
        page = chunk.get('page_number', 'N/A')
        content = chunk.get('content', '')[:500]
        formatted.append(f"[Page {page}]\n{content}")
    
    return "\n---\n".join(formatted)

def verification_agent(state: AgentState) -> AgentState:
    research_output = state.get("research_output", "")
    chunks = state.get("chunks", [])
    
    if not research_output:
        state["verification_output"] = "No research findings to verify"
        state["next_agent"] = "synthesis"
        return state
    
    chunks_text = format_chunks_for_verification(chunks)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a verification agent. Cross-reference research claims against source documents.

For each claim in the research output:
1. Check if the source chunk actually contains the stated information
2. Verify numbers, dates, and page references are accurate
3. Flag any claims not supported by sources

Output format:
✅ [Claim] - Verified (Page X confirms this)
⚠️ [Claim] - Cannot verify (not found in sources)
❌ [Claim] - Incorrect (Source says X, not Y)

Be concise. Only list claims that need attention."""),
        ("user", """Research findings:
{research_output}

Source documents:
{chunks_text}

Verify:""")
    ])
    
    chain = prompt | llm
    
    try:
        response = chain.invoke({
            "research_output": research_output,
            "chunks_text": chunks_text
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