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
    tools = [vector_search_tool, web_search_tool]
    llm_with_tools = llm.bind_tools(tools)
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a research agent analyzing financial documents.

Your job: Extract relevant information to answer the user's question.

Available tools:
1. vector_search_tool: Read chunks from uploaded documents
2. web_search_tool: Read recent web search results (if available)

Focus on FACTS from the sources. Cite page numbers for documents.
Your output will be used by other agents."""),
        ("user", "Question: {question}")
    ])

    agent_chain = prompt | llm_with_tools

    try:
        response = agent_chain.invoke({
            "question":state["question"]
        })
        research_findings = response.content 
    except Exception as e:
        research_findings = f"Research agent failed: {str(e)}  "
    
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
    


    
