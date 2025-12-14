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
def vector_search_tool(chunks:List[Dict]) -> str:
    """Format vector search results for agent to read."""
    if not chunks:
        return "No document chunks found"
    formatted_chunks = []
    for i,chunk in enumerate(chunks):
        chunk_text = (
            f"[Chunk {i+1}] (Page {chunk['page_number']}, Similarity: {chunk['similarity']:.2f})\n"
            f"{chunk['content']}\n"
        )
        formatted_chunks.append(chunk_text)
    
    return "\n".join(formatted_chunks)

@tool
def web_search_tool(web_results:List[Dict]) -> str:
    """Format web search results for agent to read."""
    if not web_results:
        return "No web search results found"

    formatted_results = []
    for i, result in enumerate(web_results):
        result_text = (
            f"[Source {i+1}] {result['title']}\n"
            f"URL: {result['url']}\n"
            f"Content: {result['content']}\n"
        )
        formatted_results.append(result_text)
    
    return "\n".join(formatted_results)

def research_agent(state:AgentState) -> AgentState:
    # MANUALLY call tools first, then pass results to LLM
    chunks = state.get("chunks", [])
    web_results = state.get("web_results", [])

    print(f"🔍 [Research Agent] Got {len(chunks)} chunks")
    print(f"🔍 [Research Agent] Chunks type: {type(chunks)}")
    if chunks:
        print(f"🔍 [Research Agent] First chunk type: {type(chunks[0])}")
        print(f"🔍 [Research Agent] First chunk keys: {chunks[0].keys() if isinstance(chunks[0], dict) else 'NOT A DICT'}")

    # Format chunks for LLM - call function directly, not via .invoke()
    chunks_text = vector_search_tool.func(chunks)  # Use .func to bypass Pydantic validation
    web_text = web_search_tool.func(web_results) if web_results else "No web results"

    # Now create prompt with the actual data
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a research agent extracting comprehensive financial data from documents.

CRITICAL EXTRACTION RULES:
1. ONLY use information from the Document Chunks and Web Results provided below
2. DO NOT make up ANY company names, numbers, or data
3. Extract ALL relevant numbers, percentages, and metrics you find
4. Include complete context for each number:
   - Company name
   - Time period (quarter, year, specific date)
   - Metric type (revenue, profit, expenses, etc.)
   - Comparisons (YoY, QoQ if mentioned)
5. Always cite exact page numbers from the chunks
6. Use the EXACT company names, dates, and numbers from the documents

OUTPUT FORMAT:
- For financial metrics: Include ALL available data points, not just one or two
- For each metric, cite the page number
- If comparing multiple entities/periods, structure data clearly
- If information is not in chunks/results, say "Information not found in uploaded documents"

Example good output:
"Hindustan Copper Limited Q2 FY 2025 (ended Sept 30, 2025):
- Revenue from Operations: ₹718.04 crore (Page 4)
- Total Income: ₹728.95 crore (Page 4)
- Profit Before Tax: ₹248.63 crore (Page 4)
- Profit After Tax: ₹186.02 crore (Page 11)"

Your output will be used by synthesis agent to create the final report."""),
        ("user", """Question: {question}

Document Chunks:
{chunks_text}

Web Results:
{web_text}

Extract ONLY the relevant information from above to answer the question. Use exact company names and page numbers.""")
    ])

    chain = prompt | llm

    try:
        response = chain.invoke({
            "question": state["question"],
            "chunks_text": chunks_text,
            "web_text": web_text
        })
        research_findings = response.content
    except Exception as e:
        research_findings = f"Research agent failed: {str(e)}"

    state["research_output"] = research_findings

    agents_needed = state["route_info"].get("agents_needed", [])
    if "verification" in agents_needed:
        next_agent = "verification"
    elif "risk" in agents_needed:
        next_agent = "risk"
    else:
        next_agent = "synthesis"

    state["next_agent"] = next_agent
    return state
    


    
