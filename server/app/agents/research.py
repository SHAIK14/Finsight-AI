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
    """Format search results with contextual headers."""
    if not chunks:
        return "No document chunks found"
    formatted_chunks = []
    for i, chunk in enumerate(chunks):
        doc_name = chunk.get("document_name", "Document")
        section = chunk.get("section_title", "")
        page = chunk.get("page_number", "N/A")
        
        section_info = f" | {section}" if section else ""
        
        chunk_text = (
            f"[{doc_name}{section_info} | Page {page}]\n"
            f"{chunk['content']}\n"
        )
        formatted_chunks.append(chunk_text)
    
    return "\n---\n".join(formatted_chunks)

@tool
def web_search_tool(web_results:List[Dict]) -> str:
    """Format web search results for agent to read."""
    if not web_results:
        return "No web search results found"

    formatted_results = []
    for result in web_results:
        try:
            from urllib.parse import urlparse
            domain = urlparse(result['url']).netloc.replace('www.', '')
            site_name = domain.split('.')[0].capitalize()
        except:
            site_name = "Web"
        
        result_text = (
            f"[{site_name}] {result['title']}\n"
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
        ("system", """You are a research agent extracting financial data from documents and web sources.

CRITICAL RULES:
1. ONLY use information from Document Chunks and Web Results provided
2. DO NOT make up ANY data
3. Extract ALL relevant numbers with full context

FOR DOCUMENT DATA:
- Cite as: (Page X)
- Include company name, time period, metric type

FOR WEB DATA (stock prices, news):
- Cite with ACTUAL website name and URL: (Source: [Moneycontrol](https://moneycontrol.com/...))
- If multiple sources show different prices, pick the MOST RECENT or from NSE/BSE/Moneycontrol
- Do NOT list 5 different conflicting prices - pick ONE reliable source
- Include the date if available

Example for stock price:
"Hitachi Energy India stock price: ₹19,320 (Source: [Moneycontrol](https://www.moneycontrol.com/...))"

Example for document metrics:
"Revenue: ₹718.04 crore (Page 4)"

If information not found, say "Information not found in uploaded documents or web search"."""),
        ("user", """Question: {question}

Document Chunks:
{chunks_text}

Web Results:
{web_text}

Extract relevant information with proper citations:""")
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
    


    
