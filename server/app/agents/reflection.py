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


def reflection_agent(state: AgentState) -> AgentState:
    final_answer = state.get("final_answer", "")
    question = state.get("question", "")
    chunks = state.get("chunks", [])
    research_output = state.get("research_output", "")
    
    if not final_answer or len(final_answer) < 50:
        state["reflection_passed"] = False
        state["final_answer"] = "I couldn't find enough information in the documents to answer this question. Please try rephrasing or upload relevant documents."
        return state
    
    sources_summary = ""
    for i, chunk in enumerate(chunks[:5]):
        page = chunk.get("page_number", "N/A")
        content_preview = chunk.get("content", "")[:200]
        sources_summary += f"[Page {page}]: {content_preview}...\n"
    
    answer_summary = final_answer if len(final_answer) <= 3000 else (
        final_answer[:1500] + "\n...[middle truncated]...\n" + final_answer[-1500:]
    )
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You evaluate financial analysis responses for quality.

Check:
1. Does the answer address the question?
2. Are numbers/claims backed by sources or research output?
3. Any obvious fabrications (data not in sources)?

Respond with ONLY:
- "APPROVED" if good
- "NEEDS_DISCLAIMER: [brief reason]" if incomplete/uncertain"""),
        ("user", """Question: {question}

Answer:
{answer}

Research found:
{research}

Sources:
{sources}

Evaluate:""")
    ])
    
    chain = prompt | llm
    
    try:
        response = chain.invoke({
            "question": question,
            "answer": answer_summary,
            "research": research_output[:1000] if research_output else "No research output",
            "sources": sources_summary
        })
        
        evaluation = response.content.strip()
        
        if "APPROVED" in evaluation:
            state["reflection_passed"] = True
        elif "NEEDS_DISCLAIMER" in evaluation:
            state["reflection_passed"] = True
            reason = evaluation.replace("NEEDS_DISCLAIMER:", "").strip()
            state["final_answer"] = f"{final_answer}\n\n---\n*Note: {reason}*"
        else:
            state["reflection_passed"] = True
            
    except Exception as e:
        print(f"Reflection agent error: {str(e)}")
        state["reflection_passed"] = True
    
    return state
