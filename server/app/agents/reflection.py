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
    
    if not final_answer or len(final_answer) < 50:
        state["reflection_passed"] = False
        state["final_answer"] = "I couldn't find enough information in the documents to answer this question. Please try rephrasing or upload relevant documents."
        return state
    
    sources_summary = ""
    for i, chunk in enumerate(chunks[:3]):
        page = chunk.get("page_number", "N/A")
        content_preview = chunk.get("content", "")[:150]
        sources_summary += f"[Page {page}]: {content_preview}...\n"
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You evaluate financial analysis responses for quality.

Check these criteria:
1. Does the answer directly address the question asked?
2. Are claims supported by the source documents?
3. Are there specific numbers, dates, or facts (not vague statements)?
4. Is there potential hallucination (claims without source backing)?

Respond with ONLY one of:
- "APPROVED" if the answer is good
- "NEEDS_DISCLAIMER: [reason]" if answer might be incomplete or uncertain"""),
        ("user", """Question: {question}

Answer to evaluate:
{answer}

Available sources (partial):
{sources}

Evaluate:""")
    ])
    
    chain = prompt | llm
    
    try:
        response = chain.invoke({
            "question": question,
            "answer": final_answer[:2000],
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
