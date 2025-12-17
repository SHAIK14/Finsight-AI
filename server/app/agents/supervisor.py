from langgraph.graph import StateGraph, END
from app.agents.state import AgentState
from app.agents.research import research_agent
from app.agents.verification import verification_agent
from app.agents.risk import risk_agent
from app.agents.synthesis import synthesis_agent
from app.agents.reflection import reflection_agent


def route_after_research(state: AgentState) -> str:
    return state["next_agent"]


def route_after_verification(state: AgentState) -> str:
    return state["next_agent"]


def route_after_risk(state: AgentState) -> str:
    return state["next_agent"]


workflow = StateGraph(AgentState)
workflow.add_node("research", research_agent)
workflow.add_node("verification", verification_agent)
workflow.add_node("risk", risk_agent)
workflow.add_node("synthesis", synthesis_agent)
workflow.add_node("reflection", reflection_agent)

workflow.set_entry_point("research")

workflow.add_conditional_edges(
    "research",
    route_after_research,
    {
        "verification": "verification",
        "risk": "risk",
        "synthesis": "synthesis"
    }
)

workflow.add_conditional_edges(
    "verification",
    route_after_verification,
    {
        "risk": "risk",
        "synthesis": "synthesis"
    }
)

workflow.add_conditional_edges(
    "risk",
    route_after_risk,
    {
        "synthesis": "synthesis"
    }
)

workflow.add_edge("synthesis", "reflection")
workflow.add_edge("reflection", END)

agent_graph = workflow.compile()


pre_synthesis_workflow = StateGraph(AgentState)
pre_synthesis_workflow.add_node("research", research_agent)
pre_synthesis_workflow.add_node("verification", verification_agent)
pre_synthesis_workflow.add_node("risk", risk_agent)

pre_synthesis_workflow.set_entry_point("research")

pre_synthesis_workflow.add_conditional_edges(
    "research",
    route_after_research,
    {
        "verification": "verification",
        "risk": "risk",
        "synthesis": END
    }
)

pre_synthesis_workflow.add_conditional_edges(
    "verification",
    route_after_verification,
    {
        "risk": "risk",
        "synthesis": END
    }
)

pre_synthesis_workflow.add_conditional_edges(
    "risk",
    route_after_risk,
    {
        "synthesis": END
    }
)

pre_synthesis_graph = pre_synthesis_workflow.compile()
