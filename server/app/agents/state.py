from typing import TypedDict, List, Dict, Annotated
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    messages: Annotated[List, add_messages]
    question: str
    original_question: str
    session_id: str
    conversation_history: List[Dict]
    route_info: Dict
    chunks: List[Dict]
    web_results: List[Dict]
    research_output: str
    verification_output: str
    risk_output: str
    final_answer: str
    next_agent: str
    reflection_passed: bool