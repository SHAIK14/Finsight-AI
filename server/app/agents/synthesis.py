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
        ("system", """You are a synthesis agent that creates final answers for financial queries.

Your job: Combine outputs from other agents into one coherent, well-formatted answer.

You receive:
- Research findings (facts from documents/web)
- Verification results (cross-checks, if run)
- Risk analysis (risk assessment, if run)

Create a final answer that:
- Answers the user's question directly
- Uses markdown formatting (headers, lists, tables)
- Cites sources (page numbers for docs, URLs for web)
- Is concise but complete
- Highlights key numbers/percentages

Don't repeat information - synthesize it into a flowing answer."""),
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

    