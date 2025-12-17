from typing import Dict, Generator
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

llm_streaming = ChatOpenAI(
    model="gpt-4o-mini",
    openai_api_key=settings.openai_api_key,
    temperature=0,
    streaming=True
)

def synthesis_agent(state:AgentState) -> AgentState:
    research_output = state.get("research_output","")   
    verification_output = state.get("verification_output","")
    risk_output = state.get("risk_output","")
    route_info = state.get("route_info", {})
    complexity = route_info.get("complexity", "simple")
    response_style = "concise" if complexity == "simple" else "comprehensive"
    
    context_parts = []
    if research_output:
        context_parts.append(f"### Research Findings:\n{research_output}")
    if verification_output:
        context_parts.append(f"### Verification Results:\n{verification_output}")
    if risk_output:
        context_parts.append(f"### Risk Analysis:\n{risk_output}")
    
    combined_context = "\n\n".join(context_parts)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert financial analyst. Response style depends on complexity.

RESPONSE STYLE: {response_style}

**CONCISE (simple queries):**
- 2-4 sentences max, lead with the answer
- Example: "Revenue was **₹718.04 crore** for Q2 FY25, up 23.3% YoY. (Page 7)"

**COMPREHENSIVE (complex queries):**
- Use ### sections for organization
- Use markdown tables for comparisons
- End with "### Key Takeaways" (2-3 bullets)

**TABLE FORMAT (CRITICAL):**
| Metric | Value | Source |
|--------|-------|--------|
| Revenue | ₹718 Cr | Page 4 |

- NEVER use <br> or HTML tags - use separate rows instead
- Keep cells short - one value per cell
- If comparing multiple items, use separate columns

**CITATIONS:**
- Documents: (Page X)
- Web: [SiteName](url) - use actual site name from URL
- NEVER write "Source 1" or "Source 2"

**DATA INTEGRITY:**
- ONLY use data from Agent Outputs below
- If data not found, say "Not available in documents"
- Never fabricate numbers"""),
        ("user", """Question: {question}

Agent Outputs:
{context}

{response_style} answer:""")
    ])
    
    chain = prompt | llm
    
    try:
        response = chain.invoke({
            "question": state["question"],
            "context": combined_context,
            "complexity": complexity,
            "response_style": response_style
        })
        final_answer = response.content
    except Exception as e:
        final_answer = f"Synthesis failed: {str(e)}"
    
    state["final_answer"] = final_answer
    state["next_agent"] = "END"
    
    return state


def stream_synthesis(state: AgentState) -> Generator[str, None, str]:
    """Stream synthesis tokens. Yields each token, returns full answer at end."""
    research_output = state.get("research_output", "")
    verification_output = state.get("verification_output", "")
    risk_output = state.get("risk_output", "")
    route_info = state.get("route_info", {})
    complexity = route_info.get("complexity", "simple")
    response_style = "concise" if complexity == "simple" else "comprehensive"
    
    context_parts = []
    if research_output:
        context_parts.append(f"### Research Findings:\n{research_output}")
    if verification_output:
        context_parts.append(f"### Verification Results:\n{verification_output}")
    if risk_output:
        context_parts.append(f"### Risk Analysis:\n{risk_output}")
    
    combined_context = "\n\n".join(context_parts)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert financial analyst. Response style depends on complexity.

RESPONSE STYLE: {response_style}

**CONCISE (simple queries):**
- 2-4 sentences max, lead with the answer
- Example: "Revenue was **₹718.04 crore** for Q2 FY25, up 23.3% YoY. (Page 7)"

**COMPREHENSIVE (complex queries):**
- Use ### sections for organization
- Use markdown tables for comparisons
- End with "### Key Takeaways" (2-3 bullets)

**TABLE FORMAT (CRITICAL):**
| Metric | Value | Source |
|--------|-------|--------|
| Revenue | ₹718 Cr | Page 4 |

- NEVER use <br> or HTML tags - use separate rows instead
- Keep cells short - one value per cell
- If comparing multiple items, use separate columns

**CITATIONS:**
- Documents: (Page X)
- Web: [SiteName](url) - use actual site name from URL
- NEVER write "Source 1" or "Source 2"

**DATA INTEGRITY:**
- ONLY use data from Agent Outputs below
- If data not found, say "Not available in documents"
- Never fabricate numbers"""),
        ("user", """Question: {question}

Agent Outputs:
{context}

{response_style} answer:""")
    ])
    
    messages = prompt.format_messages(
        question=state["question"],
        context=combined_context,
        response_style=response_style
    )
    
    full_answer = ""
    try:
        for chunk in llm_streaming.stream(messages):
            token = chunk.content
            if token:
                full_answer += token
                yield token
    except Exception as e:
        error_msg = f"Synthesis failed: {str(e)}"
        yield error_msg
        full_answer = error_msg
    
    return full_answer